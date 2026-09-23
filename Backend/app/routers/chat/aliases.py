from fastapi import BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user

from app.routers.chat.schemas import ChatRequest
from app.routers.chat.endpoints import chat_endpoint
from app.routers.chat.router import router


@router.post("/chat/stream")
async def chat_stream_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dedicated always-streaming route. Same logic as /api/chat with stream=true."""
    req.stream = True
    return await chat_endpoint(req, background_tasks, user, db)


# Non-streaming send endpoint (used by chat.ts service)
@router.post("/chat/send")
async def send_message_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Same logic as chat_endpoint but without streaming
    req.stream = False
    return await chat_endpoint(req, background_tasks, user, db)
