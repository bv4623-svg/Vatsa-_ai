"""
app/workspace/builder.py – AI project generation, build, and auto‑fix pipeline.
Fixed: circular import with project_manager.py using __future__ annotations.
"""

from __future__ import annotations  # <-- THIS FIXES THE CIRCULAR IMPORT

import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Callable, Optional, Dict, Any, List, Awaitable, Union, TYPE_CHECKING

# No top‑level import of ProjectManager – we only use it in type hints,
# and __future__ annotations turns it into a string at runtime.
if TYPE_CHECKING:
    from app.workspace.project_manager import ProjectManager

from app.fs import WorkspaceFileSystem

logger = logging.getLogger(__name__)


class Builder:
    """
    Handles:
    - AI‑driven project generation from a user prompt (creates files, project record).
    - Building the project (npm install / build) with an auto‑fix loop using LLM patches.
    """

    def __init__(
        self,
        project_manager: ProjectManager,  # type: ignore  # noqa: F821
        llm_client: Any,
        fs: Optional[WorkspaceFileSystem] = None,
        max_build_retries: int = 3,
        build_command_install: str = "npm install",
        build_command_build: str = "npm run build",
    ):
        self.pm = project_manager
        self.llm = llm_client
        self.fs = fs or project_manager.fs
        self.max_retries = max_build_retries
        self.install_cmd = build_command_install
        self.build_cmd = build_command_build

    # ------------------------------------------------------------------
    #  AI Project Generation
    # ------------------------------------------------------------------

    async def generate_project_from_prompt(
        self,
        user_message: str,
        chat_id: int,
        user_id: Optional[int] = None,
        model: str = "claude-opus-5",
        framework: str = "react",
        temperature: float = 0.3,
    ) -> Dict[str, Any]:
        """
        Generate a complete project from a user prompt using LLM.

        Returns:
            Dict with project_id, title, list of files, and metadata.
        """
        # 1. Build system prompt
        system_prompt = (
            "You are an expert software engineer. Generate a complete, working project based on the user's request.\n"
            "Return your response in **pure JSON** with the following structure:\n"
            "{\n"
            '  "title": "Project title",\n'
            '  "files": [\n'
            '    {"path": "index.html", "content": "<html>...</html>"},\n'
            '    {"path": "style.css", "content": "..."}\n'
            "  ]\n"
            "}\n"
            "The code must be production‑ready, clean, and well‑commented. "
            "Include all necessary files. For web projects, include HTML, CSS, and JavaScript. "
            "Do NOT wrap the JSON in markdown code fences – output ONLY raw JSON."
        )

        # 2. Call LLM
        try:
            if hasattr(self.llm, "chat_completion"):
                response = await self.llm.chat_completion(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    model=model,
                    temperature=temperature,
                )
                ai_content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            elif hasattr(self.llm, "generate"):
                full_prompt = f"{system_prompt}\n\nUser request: {user_message}"
                ai_content = await self.llm.generate(full_prompt)
            else:
                raise ValueError("LLM client must have either 'chat_completion' or 'generate' async method.")

        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise RuntimeError(f"Failed to generate code from AI: {e}")

        # 3. Extract JSON from response
        try:
            json_str = self._extract_json(ai_content)
            project_data = json.loads(json_str)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse AI response as JSON: {e}\nResponse: {ai_content[:500]}")
            raise RuntimeError("AI response was not valid JSON")

        # 4. Create project record
        title = project_data.get("title", "Untitled Project")
        project = await self.pm.create_project(
            chat_id=chat_id,
            title=title,
            user_id=user_id,
            framework=framework,
        )

        # 5. Save files (bulk)
        files_data = project_data.get("files", [])
        saved_files = await self.pm.save_files_from_ai(
            project_id=project.id,
            files=files_data,
            overwrite=True,
        )

        file_infos = [
            {
                "id": f.id,
                "path": f.path,
                "content": f.content,
            }
            for f in saved_files
        ]

        logger.info(f"Generated project {project.id} with {len(file_infos)} files")
        return {
            "project_id": project.id,
            "title": project.title,
            "files": file_infos,
            "created_at": project.created_at.isoformat(),
        }

    @staticmethod
    def _extract_json(text: str) -> str:
        """Extract JSON from text that may contain markdown or extra text."""
        text = re.sub(r"```(?:json)?\s*", "", text, flags=re.DOTALL)
        text = re.sub(r"```\s*", "", text, flags=re.DOTALL)
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if match:
            return match.group(1)
        return text.strip()

    # ------------------------------------------------------------------
    #  Build & Auto‑Fix Pipeline
    # ------------------------------------------------------------------

    async def build_with_auto_fix(
        self,
        project_id: int,
        on_log: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> bool:
        """
        Run install + build with an auto‑fix loop.

        Args:
            project_id: ID of the project.
            on_log: Async callback for log messages.

        Returns:
            True if build succeeded within retries, else False.
        """
        project_dir = self.fs._get_project_dir(project_id)
        if not project_dir.exists():
            msg = f"Project directory {project_dir} does not exist"
            await self._log(on_log, f"❌ {msg}")
            return False

        project = await self.pm.get_project(project_id)
        if not project:
            await self._log(on_log, f"❌ Project {project_id} not found in DB")
            return False

        for attempt in range(self.max_retries):
            await self._log(on_log, f"🔄 Build attempt {attempt + 1}/{self.max_retries}")

            project.status = "building"
            await self.pm.db.commit()

            success, error_msg = await self._run_build(project_dir, on_log)

            if success:
                project.status = "running"
                await self.pm.db.commit()
                await self._log(on_log, "✅ Build successful!")
                return True

            await self._log(on_log, f"❌ Build failed: {error_msg[:200]}")

            if attempt == self.max_retries - 1:
                project.status = "error"
                await self.pm.db.commit()
                await self._log(on_log, "❌ All build attempts failed.")
                return False

            await self._log(on_log, f"🔄 Attempt {attempt + 1} failed. Asking AI for a fix...")
            patch_applied = await self._apply_ai_fix(project_id, error_msg, on_log)
            if not patch_applied:
                await self._log(on_log, "⚠️ No fix generated. Stopping retries.")
                project.status = "error"
                await self.pm.db.commit()
                return False

        return False

    async def _run_build(
        self,
        cwd: Path,
        on_log: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> tuple[bool, str]:
        await self._log(on_log, "📦 Installing dependencies...")
        out, err, code = await self._run_command(self.install_cmd, cwd)
        if code != 0:
            msg = f"Install failed: {err[:200] or out[:200]}"
            await self._log(on_log, f"❌ {msg}")
            return False, msg

        await self._log(on_log, "🔨 Building project...")
        out, err, code = await self._run_command(self.build_cmd, cwd)
        if code != 0:
            msg = f"Build error: {err[:200] or out[:200]}"
            await self._log(on_log, f"❌ {msg}")
            return False, msg

        return True, "Success"

    async def _run_command(self, command: str, cwd: Path) -> tuple[str, str, int]:
        args = command.split()
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        out_text = stdout.decode("utf-8", errors="ignore")
        err_text = stderr.decode("utf-8", errors="ignore")
        return out_text, err_text, process.returncode

    async def _apply_ai_fix(
        self,
        project_id: int,
        error_msg: str,
        on_log: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> bool:
        prompt = (
            f"The project build failed with the following error:\n\n{error_msg}\n\n"
            "Please suggest a **single search‑and‑replace patch** to fix the issue.\n"
            "Return only a JSON array of patches with the following format:\n"
            '[{"file": "path/to/file", "search": "exact text to find", "replace": "replacement text"}]\n'
            "If no fix is possible, return []."
        )

        try:
            if hasattr(self.llm, "generate"):
                response = await self.llm.generate(prompt)
            else:
                response = await self.llm.chat_completion(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                response = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"LLM fix generation failed: {e}")
            await self._log(on_log, f"⚠️ LLM failed to generate fix: {e}")
            return False

        try:
            json_str = self._extract_json(response)
            patches = json.loads(json_str)
            if not isinstance(patches, list):
                patches = []
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from fix callback: {response[:200]}")
            await self._log(on_log, "⚠️ AI response was not valid JSON; no fix applied.")
            return False

        if not patches:
            await self._log(on_log, "ℹ️ AI suggested no changes.")
            return False

        try:
            updated_paths = await self.pm.apply_patches(project_id, patches)
        except Exception as e:
            logger.error(f"Failed to apply patches: {e}")
            await self._log(on_log, f"⚠️ Failed to apply patches: {e}")
            return False

        if updated_paths:
            await self._log(on_log, f"✅ Applied fixes to {len(updated_paths)} file(s): {', '.join(updated_paths)}")
            return True
        else:
            await self._log(on_log, "⚠️ No changes made by the patch – likely search string not found.")
            return False

    async def _log(
        self,
        callback: Optional[Callable[[str], Awaitable[None]]],
        message: str,
    ) -> None:
        logger.info(message)
        if callback:
            try:
                await callback(message)
            except Exception as e:
                logger.warning(f"Log callback failed: {e}")


# ------------------------------------------------------------------
#  Convenience factory (optional)
# ------------------------------------------------------------------
def create_builder(
    db_session,
    llm_client,
    workspace_base=None,
    max_retries=3,
) -> Builder:
    """
    Create a Builder instance with a fresh ProjectManager and filesystem.
    """
    # Lazy import to avoid circular dependency
    from app.workspace.project_manager import ProjectManager  # noqa
    pm = ProjectManager(db=db_session, llm_client=llm_client, workspace_base=workspace_base)
    return Builder(project_manager=pm, llm_client=llm_client, max_build_retries=max_retries)