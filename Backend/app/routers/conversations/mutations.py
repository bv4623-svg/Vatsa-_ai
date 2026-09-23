from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.services.library import delete_conversation_item
from app.routers.conversations.schemas import UpdateConvRequest
from app.routers.conversations.router import router


@router.patch("/conversations/{conv_id}")
def update_conversation(
    conv_id: str,
    payload: UpdateConvRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.title is not None:
        conv.title = payload.title
    if payload.pinned is not None:
        conv.pinned = payload.pinned
    if payload.favorite is not None:
        conv.favorite = payload.favorite
    if payload.archived is not None:
        conv.archived = payload.archived
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(conv)
    return conv.to_dict()

@router.delete("/conversations/{conv_id}")
def delete_conversation(
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

    db.delete(conv)
    db.commit()
    delete_conversation_item(db, current_user.id, conv_id)
    return {"success": True, "id": conv_id}

@router.delete("/conversations")
def delete_all_conversations(
    workspace: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if workspace:
        q = q.filter(Conversation.workspace == workspace)
    conv_ids = [c.id for c in q.all()]
    count = q.delete()
    db.commit()
    for conv_id in conv_ids:
        delete_conversation_item(db, current_user.id, conv_id)
    return {"success": True, "deleted": count}
