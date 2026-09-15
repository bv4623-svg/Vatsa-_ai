import asyncio
import subprocess
import shlex
from typing import Optional
import websockets

class TerminalSession:
    """Manages a terminal subprocess with WebSocket streaming."""

    def __init__(self, project_path: str):
        self.project_path = project_path
        self.process: Optional[asyncio.subprocess.Process] = None
        self._read_task: Optional[asyncio.Task] = None

    async def start(self, websocket: websockets.WebSocketServerProtocol):
        """Spawn a shell and forward I/O to websocket."""
        # Use pty for interactive shell
        self.process = await asyncio.create_subprocess_shell(
            "bash",
            cwd=self.project_path,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True
        )
        self._read_task = asyncio.create_task(self._forward_output(websocket))

    async def _forward_output(self, websocket):
        """Read stdout/stderr and send to websocket."""
        try:
            while self.process and self.process.stdout:
                line = await self.process.stdout.readline()
                if not line:
                    break
                await websocket.send(line.decode('utf-8', errors='ignore'))
        except Exception as e:
            print(f"Terminal forward error: {e}")
        finally:
            if self.process and self.process.returncode is None:
                self.process.terminate()

    async def input(self, data: str):
        """Send user input to the terminal process."""
        if self.process and self.process.stdin:
            self.process.stdin.write(data.encode())
            await self.process.stdin.drain()

    async def stop(self):
        """Terminate the session."""
        if self.process:
            self.process.terminate()
            if self._read_task:
                self._read_task.cancel()
            await self.process.wait()