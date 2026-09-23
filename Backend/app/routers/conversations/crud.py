import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.routers.conversations.schemas import CreateConvRequest
from app.routers.conversations.router import router


@router.get("/conversations")
def list_conversations(
    workspace: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if workspace:
        q = q.filter(Conversation.workspace == workspace)
    convs = q.order_by(Conversation.pinned.desc(), Conversation.updated_at.desc()).all()
    return [c.to_dict() for c in convs]

@router.post("/conversations")
def create_conversation(
    payload: CreateConvRequest = CreateConvRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv_id = f"conv_{uuid.uuid4().hex[:12]}"
    conv = Conversation(
        id=conv_id,
        user_id=current_user.id,
        title=payload.title or ("New Project" if payload.workspace == "code" else "New Chat"),
        workspace=payload.workspace or "chat",
        model=payload.model,
        messages=[],
        pinned=False,
        favorite=False,
        archived=False
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv.to_dict()

@router.get("/conversations/{conv_id}")
def get_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.to_dict()
