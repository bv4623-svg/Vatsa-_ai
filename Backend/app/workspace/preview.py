"""
app/workspace/preview.py – Async Preview Server and File Serving Router.

Features:
- Async start/stop of a development server (Vite, Next, etc.)
- Automatic port allocation with retries
- Health check to confirm server is ready
- File serving with proper MIME types
- Environment‑configurable settings
- Graceful process termination
"""

import os  # <-- FIXED: added missing import
import asyncio
import logging
import mimetypes
import socket
import time
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, HTMLResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# =============================================================================
#  Preview Server Configuration
# =============================================================================

DEFAULT_PORT = int(os.getenv("PREVIEW_PORT", "3000"))
DEFAULT_HOST = os.getenv("PREVIEW_HOST", "0.0.0.0")
PROJECTS_ROOT = Path(os.getenv("PROJECTS_ROOT", "./projects")).resolve()
MAX_START_ATTEMPTS = 3
START_TIMEOUT = 10  # seconds to wait for server to respond


# =============================================================================
#  Preview Server Class (Async)
# =============================================================================

class PreviewServer:
    """
    Manages an async subprocess for a development server (npm run dev).
    Handles starting, health‑checking, and stopping the server.
    """

    def __init__(
        self,
        project_path: Path,
        port: int = DEFAULT_PORT,
        host: str = DEFAULT_HOST,
        command: str = "npm run dev",
    ):
        self.project_path = project_path
        self.port = port
        self.host = host
        self.command = command
        self.process: Optional[asyncio.subprocess.Process] = None
        self.url: Optional[str] = None
        self._started = False

    async def start(self) -> Optional[str]:
        """
        Start the dev server asynchronously and wait until it is ready.
        Returns the server URL if successful, else None.
        """
        if self._started:
            logger.warning("Server already started for %s", self.project_path)
            return self.url

        if not self.project_path.exists():
            logger.error("Project path does not exist: %s", self.project_path)
            return None

        # Ensure package.json exists
        if not (self.project_path / "package.json").exists():
            logger.error("No package.json found in %s", self.project_path)
            return None

        # Try to find an available port if the default is busy
        actual_port = await self._find_available_port(self.port)
        if actual_port is None:
            logger.error("No available port found starting from %d", self.port)
            return None
        self.port = actual_port

        # Build command arguments – split into list for subprocess
        cmd_parts = self.command.split()
        # add --port and --host only if not already present
        if "--port" not in cmd_parts and "-p" not in cmd_parts:
            cmd_parts.extend(["--port", str(self.port)])
        if "--host" not in cmd_parts:
            cmd_parts.extend(["--host", self.host])

        logger.info("Starting preview server: %s in %s", " ".join(cmd_parts), self.project_path)
        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd_parts,
                cwd=str(self.project_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # Give the process a moment to start
            await asyncio.sleep(1)

            # Check if server is responsive
            self.url = f"http://localhost:{self.port}"
            if await self._wait_for_server():
                self._started = True
                logger.info("Preview server started at %s", self.url)
                return self.url
            else:
                logger.error("Server started but not responding at %s", self.url)
                await self.stop()
                return None
        except Exception as e:
            logger.error("Failed to start preview server: %s", e, exc_info=True)
            await self.stop()
            return None

    async def stop(self) -> None:
        """Terminate the server process gracefully."""
        if self.process is None:
            return
        logger.info("Stopping preview server for %s", self.project_path)
        try:
            self.process.terminate()
            # Wait a bit for graceful shutdown
            await asyncio.sleep(1)
            if self.process.returncode is None:
                self.process.kill()
            await self.process.wait()
        except Exception as e:
            logger.error("Error stopping preview server: %s", e)
        finally:
            self.process = None
            self.url = None
            self._started = False
            logger.info("Preview server stopped")

    async def _wait_for_server(self, timeout: int = START_TIMEOUT) -> bool:
        """
        Ping the server until it responds or timeout.
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            if await self._is_port_open(self.host, self.port):
                return True
            await asyncio.sleep(0.5)
        return False

    @staticmethod
    async def _is_port_open(host: str, port: int) -> bool:
        """Check if a port is open and accepting connections."""
        try:
            reader, writer = await asyncio.open_connection(host, port)
            writer.close()
            await writer.wait_closed()
            return True
        except (ConnectionRefusedError, OSError):
            return False

    @staticmethod
    async def _find_available_port(start_port: int, max_attempts: int = 50) -> Optional[int]:
        """Find an available port starting from start_port."""
        port = start_port
        for _ in range(max_attempts):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind(("", port))
                sock.close()
                return port
            except OSError:
                port += 1
        return None


# =============================================================================
#  FastAPI Router for File Serving
# =============================================================================

# Extend mimetypes with common web extensions
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")

router = APIRouter(prefix="/preview", tags=["preview"])


@router.get("/{project_id}/{filename:path}")
async def serve_file(project_id: int, filename: str):
    """
    Serve a static file from a project's build/output directory.
    If filename is empty or points to a directory, serve index.html.
    """
    project_dir = PROJECTS_ROOT / str(project_id)
    file_path = project_dir / filename

    # Security: prevent path traversal
    try:
        resolved = file_path.resolve()
        if not str(resolved).startswith(str(project_dir.resolve())):
            raise HTTPException(403, "Access denied")
    except (ValueError, OSError):
        raise HTTPException(400, "Invalid path")

    # If path is a directory or empty, look for index.html
    if filename == "" or filename.endswith("/") or file_path.is_dir():
        index_path = file_path / "index.html" if file_path.is_dir() else project_dir / "index.html"
        if index_path.exists():
            file_path = index_path
        else:
            raise HTTPException(404, "File not found")

    if not file_path.exists():
        raise HTTPException(404, "File not found")

    if not file_path.is_file():
        raise HTTPException(400, "Not a file")

    # Determine content type
    content_type, _ = mimetypes.guess_type(file_path)
    if content_type is None:
        content_type = "application/octet-stream"

    # For development, disable caching to avoid stale files
    return FileResponse(
        file_path,
        media_type=content_type,
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.get("/{project_id}")
async def serve_project_index(project_id: int):
    """Redirect to index.html of the project."""
    return await serve_file(project_id, "index.html")


# =============================================================================
#  API endpoints to start/stop preview server (optional)
# =============================================================================

class PreviewStartRequest(BaseModel):
    project_id: int
    port: Optional[int] = DEFAULT_PORT


# In‑memory store of active preview servers (for demo; in production use a registry)
_active_servers: Dict[int, PreviewServer] = {}


@router.post("/start")
async def start_preview(req: PreviewStartRequest):
    """Start a preview server for a given project."""
    project_dir = PROJECTS_ROOT / str(req.project_id)
    if not project_dir.exists():
        raise HTTPException(404, f"Project {req.project_id} not found on disk")

    # Stop any existing server for this project
    if req.project_id in _active_servers:
        await _active_servers[req.project_id].stop()
        del _active_servers[req.project_id]

    server = PreviewServer(project_dir, port=req.port or DEFAULT_PORT)
    url = await server.start()
    if url is None:
        raise HTTPException(500, "Failed to start preview server")

    _active_servers[req.project_id] = server
    return {"url": url, "port": server.port}


@router.post("/stop/{project_id}")
async def stop_preview(project_id: int):
    """Stop the preview server for a project."""
    if project_id in _active_servers:
        await _active_servers[project_id].stop()
        del _active_servers[project_id]
        return {"status": "stopped"}
    raise HTTPException(404, "No active preview server for this project")


@router.get("/status/{project_id}")
async def preview_status(project_id: int):
    """Check if a preview server is running and return its URL."""
    if project_id in _active_servers and _active_servers[project_id]._started:
        return {"running": True, "url": _active_servers[project_id].url}
    return {"running": False}


# =============================================================================
#  Shutdown cleanup (optional – can be called on app shutdown)
# =============================================================================

async def shutdown_preview_servers():
    """Stop all active preview servers gracefully."""
    for server in _active_servers.values():
        await server.stop()
    _active_servers.clear()