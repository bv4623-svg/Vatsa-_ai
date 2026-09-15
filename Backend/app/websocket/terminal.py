from fastapi import WebSocket, WebSocketDisconnect
from app.workspace.terminal import TerminalSession

async def terminal_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    # Get project path from DB or config
    project_path = f"./workspace/{project_id}"  # adjust
    session = TerminalSession(project_path)
    try:
        await session.start(websocket)
        while True:
            # Receive user input and send to terminal
            data = await websocket.receive_text()
            await session.input(data)
    except WebSocketDisconnect:
        await session.stop()
    except Exception as e:
        print(f"Terminal error: {e}")
        await session.stop()