"""
app/fs.py – Async filesystem manager for project workspaces.
Handles all file operations with security, logging, and error handling.
"""

import os
import shutil
import logging
from pathlib import Path
from typing import List, Optional, Union
import aiofiles
from aiofiles import os as aio_os

logger = logging.getLogger(__name__)

# Default root directory – can be overridden via env or constructor
DEFAULT_PROJECTS_ROOT = Path(os.getenv("PROJECTS_ROOT", "./projects")).resolve()

class WorkspaceFileSystem:
    """
    Async filesystem manager for project workspaces.
    All operations are async and safe for concurrent use.
    """

    def __init__(self, base_path: Union[str, Path] = DEFAULT_PROJECTS_ROOT):
        """
        Initialize with a base directory for all projects.

        Args:
            base_path: Root directory where project folders are stored.
                       Defaults to ./projects relative to backend root.
        """
        self.base_path = Path(base_path).resolve()
        # Ensure base path exists on init
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Filesystem initialized with base path: {self.base_path}")

    def _get_project_dir(self, project_id: Union[str, int]) -> Path:
        """Return the absolute path to a project's directory."""
        return self.base_path / str(project_id)

    async def ensure_project_dir(self, project_id: Union[str, int]) -> Path:
        """
        Create the project directory if it doesn't exist.

        Args:
            project_id: Project identifier (string or int).

        Returns:
            Path to the project directory.
        """
        project_dir = self._get_project_dir(project_id)
        try:
            project_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"Failed to create project directory {project_dir}: {e}")
            raise
        return project_dir

    async def write_file(
        self,
        project_id: Union[str, int],
        file_path: str,
        content: str,
        encoding: str = "utf-8"
    ) -> Path:
        """
        Write content to a file inside the project workspace.
        Creates parent directories as needed.

        Args:
            project_id: Project identifier.
            file_path: Relative path to the file (e.g., "src/App.js").
            content: File content (text).
            encoding: File encoding (default utf-8).

        Returns:
            Absolute Path to the written file.

        Raises:
            OSError: If file cannot be written.
        """
        # Security: prevent directory traversal attacks
        if ".." in file_path or file_path.startswith("/"):
            raise ValueError(f"Invalid file path: {file_path}")

        project_dir = await self.ensure_project_dir(project_id)
        full_path = (project_dir / file_path).resolve()

        # Ensure the resolved path is still inside the project directory
        if not str(full_path).startswith(str(project_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")

        # Create parent directories
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file asynchronously
        try:
            async with aiofiles.open(full_path, "w", encoding=encoding) as f:
                await f.write(content)
            logger.debug(f"Wrote file: {full_path}")
        except OSError as e:
            logger.error(f"Failed to write file {full_path}: {e}")
            raise

        return full_path

    async def read_file(
        self,
        project_id: Union[str, int],
        file_path: str,
        encoding: str = "utf-8"
    ) -> Optional[str]:
        """
        Read content from a file.

        Args:
            project_id: Project identifier.
            file_path: Relative path to the file.
            encoding: File encoding.

        Returns:
            File content as string, or None if file not found.

        Raises:
            ValueError: On path traversal attempt.
            OSError: On read errors.
        """
        # Security check
        if ".." in file_path or file_path.startswith("/"):
            raise ValueError(f"Invalid file path: {file_path}")

        project_dir = self._get_project_dir(project_id)
        full_path = (project_dir / file_path).resolve()

        if not str(full_path).startswith(str(project_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")

        if not full_path.exists():
            return None
        if not full_path.is_file():
            raise IsADirectoryError(f"{full_path} is a directory, not a file")

        try:
            async with aiofiles.open(full_path, "r", encoding=encoding) as f:
                return await f.read()
        except OSError as e:
            logger.error(f"Failed to read file {full_path}: {e}")
            raise

    async def delete_file(self, project_id: Union[str, int], file_path: str) -> bool:
        """
        Delete a single file.

        Args:
            project_id: Project identifier.
            file_path: Relative path to the file.

        Returns:
            True if file existed and was deleted, False otherwise.

        Raises:
            ValueError: On path traversal.
            OSError: On deletion error.
        """
        if ".." in file_path or file_path.startswith("/"):
            raise ValueError(f"Invalid file path: {file_path}")

        project_dir = self._get_project_dir(project_id)
        full_path = (project_dir / file_path).resolve()

        if not str(full_path).startswith(str(project_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")

        if not full_path.exists():
            return False
        if not full_path.is_file():
            raise IsADirectoryError(f"{full_path} is a directory, not a file")

        try:
            await aio_os.remove(full_path)
            logger.debug(f"Deleted file: {full_path}")
            return True
        except OSError as e:
            logger.error(f"Failed to delete file {full_path}: {e}")
            raise

    async def list_files(
        self,
        project_id: Union[str, int],
        recursive: bool = True
    ) -> List[str]:
        """
        List all files inside the project workspace.

        Args:
            project_id: Project identifier.
            recursive: If True, list recursively; if False, only top-level files.

        Returns:
            List of relative file paths (strings).
        """
        project_dir = self._get_project_dir(project_id)
        if not project_dir.exists():
            return []

        files = []
        try:
            if recursive:
                # Walk recursively
                for root, dirs, filenames in await aio_os.walk(project_dir):
                    for filename in filenames:
                        rel_path = Path(root).relative_to(project_dir)
                        files.append(str(rel_path / filename))
            else:
                # Only direct children
                for item in project_dir.iterdir():
                    if item.is_file():
                        files.append(item.name)
        except OSError as e:
            logger.error(f"Failed to list files for project {project_id}: {e}")
            raise

        return files

    async def delete_project(self, project_id: Union[str, int]) -> None:
        """
        Delete the entire project directory and all its contents.

        Args:
            project_id: Project identifier.

        Raises:
            OSError: On deletion error.
        """
        project_dir = self._get_project_dir(project_id)
        if not project_dir.exists():
            logger.warning(f"Project directory {project_dir} does not exist; nothing to delete.")
            return

        try:
            # Use aiofiles? shutil.rmtree is blocking; we run it in a thread pool.
            # We can use asyncio.to_thread for truly async behaviour.
            import asyncio
            await asyncio.to_thread(shutil.rmtree, project_dir)
            logger.info(f"Deleted project directory: {project_dir}")
        except OSError as e:
            logger.error(f"Failed to delete project {project_id}: {e}")
            raise

    async def ensure_file_exists(self, project_id: Union[str, int], file_path: str) -> bool:
        """
        Check if a file exists.

        Args:
            project_id: Project identifier.
            file_path: Relative path.

        Returns:
            True if file exists and is a file, else False.
        """
        if ".." in file_path or file_path.startswith("/"):
            raise ValueError(f"Invalid file path: {file_path}")

        project_dir = self._get_project_dir(project_id)
        full_path = (project_dir / file_path).resolve()
        if not str(full_path).startswith(str(project_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")
        return full_path.exists() and full_path.is_file()

    async def get_file_size(self, project_id: Union[str, int], file_path: str) -> Optional[int]:
        """
        Get the size of a file in bytes.

        Args:
            project_id: Project identifier.
            file_path: Relative path.

        Returns:
            Size in bytes, or None if file not found.
        """
        if ".." in file_path or file_path.startswith("/"):
            raise ValueError(f"Invalid file path: {file_path}")

        project_dir = self._get_project_dir(project_id)
        full_path = (project_dir / file_path).resolve()
        if not str(full_path).startswith(str(project_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")

        if not full_path.exists() or not full_path.is_file():
            return None
        return full_path.stat().st_size

# -------------------------------------------------------------------
# Convenience singleton instance (can be used as a global)
# -------------------------------------------------------------------
_fs_instance: Optional[WorkspaceFileSystem] = None

def get_filesystem(base_path: Union[str, Path, None] = None) -> WorkspaceFileSystem:
    """
    Get a singleton instance of WorkspaceFileSystem.
    If base_path is provided, it creates a new instance (ignoring singleton).
    """
    global _fs_instance
    if base_path is not None:
        return WorkspaceFileSystem(base_path)
    if _fs_instance is None:
        _fs_instance = WorkspaceFileSystem()
    return _fs_instance

# -------------------------------------------------------------------
# Example usage
# -------------------------------------------------------------------
# fs = get_filesystem()
# await fs.write_file("123", "src/App.js", "console.log('hello')")
# content = await fs.read_file("123", "src/App.js")
# await fs.delete_project("123")