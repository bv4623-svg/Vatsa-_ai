"""
app/managers/project_manager.py – Async project management layer.
Handles project CRUD, file storage, patching, building, and preview.
"""
import os
import logging
from typing import Optional, List, Dict, Any, Callable, Awaitable
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import SQLAlchemyError

from app.models.project import Project
from app.models.file import File
from app.models.build_log import BuildLog  # optional
from app.fs import WorkspaceFileSystem, get_filesystem
from app.workspace.patch_engine import PatchEngine
from app.workspace.builder import Builder
from app.workspace.preview import PreviewServer
from app.providers.openrouter import OpenRouterProvider  # or your LLM client

logger = logging.getLogger(__name__)


class ProjectManager:
    """
    High-level manager for project operations.
    All methods are async and use an AsyncSession for database operations.
    """

    def __init__(
        self,
        db: AsyncSession,
        llm_client: Any,  # e.g., OpenRouterProvider or custom LLMClient
        workspace_base: Optional[Path] = None,
        fs: Optional[WorkspaceFileSystem] = None,
        patch_engine: Optional[PatchEngine] = None,
        builder: Optional[Builder] = None,
        preview_server_class: type = PreviewServer,
    ):
        """
        Initialize the manager.

        Args:
            db: Async SQLAlchemy session.
            llm_client: Client for LLM interactions (must have a `generate` method).
            workspace_base: Root directory for project files (default from env).
            fs: Optional custom filesystem instance (else creates one).
            patch_engine: Optional patch engine (default new instance).
            builder: Optional Builder instance (will be created if not provided).
            preview_server_class: Class to instantiate for previews.
        """
        self.db = db
        self.llm = llm_client
        self.fs = fs or get_filesystem(workspace_base)
        self.patch_engine = patch_engine or PatchEngine()
        self.builder = builder or Builder(
            workspace_root=self.fs.base_path,
            ai_fix_callback=self._ai_fix_callback,  # type: ignore
        )
        self.preview_server_class = preview_server_class

    # ------------------------------------------------------------------
    #  Project CRUD
    # ------------------------------------------------------------------

    async def create_project(
        self,
        chat_id: int,
        title: Optional[str] = None,
        framework: str = "react",
        user_id: Optional[int] = None,
        workspace: str = "code",
    ) -> Project:
        """
        Create a new project record and its disk workspace.

        Args:
            chat_id: Associated chat session ID.
            title: Project title (default "Untitled").
            framework: Framework name (react, vue, etc.).
            user_id: Optional owner ID.
            workspace: Workspace type.

        Returns:
            The created Project instance.
        """
        project = Project(
            chat_id=chat_id,
            user_id=user_id,
            title=title or "Untitled",
            framework=framework,
            workspace=workspace,
            status="idle",
        )
        try:
            self.db.add(project)
            await self.db.commit()
            await self.db.refresh(project)
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to create project: {e}")
            raise

        # Ensure the workspace directory exists on disk
        try:
            await self.fs.ensure_project_dir(project.id)
        except Exception as e:
            # If disk creation fails, delete the DB record to keep consistency
            logger.error(f"Failed to create workspace for project {project.id}: {e}")
            await self.db.delete(project)
            await self.db.commit()
            raise RuntimeError(f"Could not create project workspace: {e}")

        logger.info(f"Created project {project.id} with title '{project.title}'")
        return project

    async def get_project(self, project_id: int) -> Optional[Project]:
        """Retrieve a project by ID."""
        return await self.db.get(Project, project_id)

    async def get_projects_by_chat(self, chat_id: int) -> List[Project]:
        """Retrieve all projects for a given chat."""
        stmt = select(Project).where(
            Project.chat_id == chat_id,
            Project.is_deleted == False
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update_project_title(self, project_id: int, new_title: str) -> Optional[Project]:
        """Update the title of a project."""
        project = await self.get_project(project_id)
        if not project:
            return None
        project.title = new_title
        try:
            await self.db.commit()
            await self.db.refresh(project)
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to update project title: {e}")
            raise
        return project

    async def delete_project(self, project_id: int, hard_delete: bool = False) -> bool:
        """
        Delete a project.

        Args:
            project_id: Project ID.
            hard_delete: If True, physically delete from DB and disk.
                         If False, perform soft delete (set is_deleted=True).

        Returns:
            True if project existed and was deleted, else False.
        """
        project = await self.get_project(project_id)
        if not project:
            return False

        try:
            if hard_delete:
                # Remove from database
                await self.db.delete(project)
                # Remove from disk
                await self.fs.delete_project(project_id)
                await self.db.commit()
                logger.info(f"Hard-deleted project {project_id}")
            else:
                project.is_deleted = True
                await self.db.commit()
                logger.info(f"Soft-deleted project {project_id}")
            return True
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to delete project {project_id}: {e}")
            raise

    # ------------------------------------------------------------------
    #  File Operations (sync with database and disk)
    # ------------------------------------------------------------------

    async def add_file(
        self,
        project_id: int,
        path: str,
        content: str,
        filename: Optional[str] = None,
        is_binary: bool = False,
    ) -> File:
        """
        Add a new file to a project (both DB and disk).

        Args:
            project_id: Project ID.
            path: Relative file path (e.g., "src/App.js").
            content: File content (text).
            filename: Optional base filename (extracted from path if not given).
            is_binary: Whether the file is binary.

        Returns:
            The created File instance.
        """
        project = await self.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Ensure file doesn't already exist
        stmt = select(File).where(File.project_id == project_id, File.path == path)
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none() is not None:
            raise ValueError(f"File '{path}' already exists in project {project_id}")

        # Derive filename if not provided
        if filename is None:
            filename = Path(path).name

        # Create DB record
        db_file = File(
            project_id=project_id,
            path=path,
            filename=filename,
            content=content if not is_binary else None,
            is_binary=is_binary,
        )
        self.db.add(db_file)

        # Write to disk (only for non-binary)
        if not is_binary:
            try:
                await self.fs.write_file(project_id, path, content)
            except Exception as e:
                await self.db.rollback()
                logger.error(f"Failed to write file to disk: {e}")
                raise
        # For binary files, metadata is stored; content is handled separately.

        try:
            await self.db.commit()
            await self.db.refresh(db_file)
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Database error while adding file: {e}")
            raise

        logger.info(f"Added file '{path}' to project {project_id}")
        return db_file

    async def get_files(self, project_id: int) -> List[File]:
        """Retrieve all file records for a project."""
        stmt = select(File).where(File.project_id == project_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_file_by_path(self, project_id: int, path: str) -> Optional[File]:
        """Get a specific file by path."""
        stmt = select(File).where(File.project_id == project_id, File.path == path)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_file_content(self, project_id: int, path: str, new_content: str) -> Optional[File]:
        """
        Update the content of an existing file (both DB and disk).

        Returns:
            Updated File object, or None if not found.
        """
        db_file = await self.get_file_by_path(project_id, path)
        if not db_file:
            return None

        # Update DB
        db_file.content = new_content
        # Update disk
        try:
            await self.fs.write_file(project_id, path, new_content)
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to write updated file to disk: {e}")
            raise

        try:
            await self.db.commit()
            await self.db.refresh(db_file)
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Database error while updating file: {e}")
            raise

        return db_file

    async def delete_file(self, project_id: int, path: str) -> bool:
        """
        Delete a file (both DB and disk).

        Returns:
            True if deleted, False if not found.
        """
        db_file = await self.get_file_by_path(project_id, path)
        if not db_file:
            return False

        # Delete from disk
        await self.fs.delete_file(project_id, path)

        # Delete from DB
        await self.db.delete(db_file)
        try:
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Database error while deleting file: {e}")
            raise

        logger.info(f"Deleted file '{path}' from project {project_id}")
        return True

    # ------------------------------------------------------------------
    #  Bulk operations from AI
    # ------------------------------------------------------------------

    async def save_files_from_ai(
        self,
        project_id: int,
        files: List[Dict[str, str]],
        overwrite: bool = True,
    ) -> List[File]:
        """
        Save or update multiple files (as generated by AI).

        Args:
            project_id: Project ID.
            files: List of dicts with keys "path" and "content".
            overwrite: If True, update existing files; if False, raise on conflict.

        Returns:
            List of File objects (created or updated).
        """
        project = await self.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        saved_files = []
        for file_data in files:
            path = file_data.get("path")
            content = file_data.get("content")
            if not path or content is None:
                continue

            existing = await self.get_file_by_path(project_id, path)
            if existing and not overwrite:
                raise ValueError(f"File '{path}' already exists and overwrite is False")

            if existing:
                # Update
                existing.content = content
                await self.fs.write_file(project_id, path, content)
                saved_files.append(existing)
            else:
                # Create
                new_file = await self.add_file(
                    project_id=project_id,
                    path=path,
                    content=content,
                    is_binary=False,
                )
                saved_files.append(new_file)

        # Commit all changes (already committed in individual ops, but we keep it consistent)
        # For performance, consider wrapping in a transaction, but simplicity is fine.
        return saved_files

    # ------------------------------------------------------------------
    #  Patching (search/replace)
    # ------------------------------------------------------------------

    async def apply_patches(
        self,
        project_id: int,
        patches: List[Dict[str, str]],
    ) -> List[str]:
        """
        Apply a list of search/replace patches to files.

        Each patch dict should contain:
            - "file": file path
            - "search": string to search for
            - "replace": replacement string

        Returns:
            List of file paths that were actually modified.
        """
        updated_paths = []
        for patch in patches:
            file_path = patch.get("file")
            search = patch.get("search")
            replace = patch.get("replace")
            if not file_path or search is None or replace is None:
                continue

            current = await self.fs.read_file(project_id, file_path)
            if current is None:
                logger.warning(f"File '{file_path}' not found for patching")
                continue

            new_content = self.patch_engine.apply_search_replace(current, search, replace)
            if new_content != current:
                db_file = await self.get_file_by_path(project_id, file_path)
                if db_file:
                    db_file.content = new_content
                    await self.fs.write_file(project_id, file_path, new_content)
                    updated_paths.append(file_path)
                else:
                    logger.warning(f"File '{file_path}' exists on disk but not in DB – skipping")
            else:
                logger.debug(f"No change for '{file_path}' – patch did not match")

        try:
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to commit patches: {e}")
            raise

        return updated_paths

    # ------------------------------------------------------------------
    #  Build & Preview
    # ------------------------------------------------------------------

    async def build_project(
        self,
        project_id: int,
        on_log_callback: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> bool:
        """
        Trigger a build process with auto‑fix loop.

        Args:
            project_id: Project ID.
            on_log_callback: Async callback to receive log messages.

        Returns:
            True if build succeeded, False otherwise.
        """
        project = await self.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        project.status = "building"
        try:
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to update status: {e}")
            raise

        try:
            success = await self.builder.build_with_auto_fix(
                project_id=str(project_id),
                on_log_callback=on_log_callback,
            )
        except Exception as e:
            logger.error(f"Build failed with exception: {e}")
            project.status = "error"
            await self.db.commit()
            return False

        if success:
            project.status = "running"
            try:
                preview = self.preview_server_class(self.fs.base_path / str(project_id))
                url = await preview.start()
                project.preview_url = url
            except Exception as e:
                logger.error(f"Failed to start preview server: {e}")
                # build succeeded but preview failed – keep status as running?
                # We'll leave it as running but log the error.
        else:
            project.status = "error"

        try:
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"Failed to update final status: {e}")
            raise

        return success

    # ------------------------------------------------------------------
    #  AI Fix Callback (for builder)
    # ------------------------------------------------------------------

    async def _ai_fix_callback(self, error_msg: str) -> str:
        """
        Callback used by the Builder when a build fails.
        Uses the LLM to generate a fix patch.

        Returns:
            JSON string representing a list of patches (or empty list).
        """
        prompt = (
            f"Build error: {error_msg}\n"
            "Please suggest a single search-and-replace patch to fix it. "
            "Return JSON: [{'file': 'path/to/file', 'search': 'exact text to find', 'replace': 'replacement text'}]"
        )
        try:
            response = await self.llm.generate(prompt)
            # In practice, you'd parse the response to ensure valid JSON.
            # For now, return as-is; the builder will parse it.
            return response
        except Exception as e:
            logger.error(f"LLM call failed in fix callback: {e}")
            return "[]"