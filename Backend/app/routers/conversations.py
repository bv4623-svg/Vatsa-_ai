from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.services.library import delete_conversation_item

router = APIRouter(prefix="/api", tags=["conversations"])

class CreateConvRequest(BaseModel):
    title: Optional[str] = "New Chat"
    workspace: Optional[str] = "chat"
    model: Optional[str] = None

class UpdateConvRequest(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None
    favorite: Optional[bool] = None
    archived: Optional[bool] = None

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

@router.post("/conversations/{conv_id}/pin")
def pin_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if conv:
        conv.pinned = True
        db.commit()
    return {"success": True}

@router.delete("/conversations/{conv_id}/pin")
def unpin_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if conv:
        conv.pinned = False
        db.commit()
    return {"success": True}

@router.post("/conversations/{conv_id}/favorite")
def fav_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if conv:
        conv.favorite = True
        db.commit()
    return {"success": True}

@router.delete("/conversations/{conv_id}/favorite")
def unfav_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if conv:
        conv.favorite = False
        db.commit()
    return {"success": True}

@router.post("/conversations/{conv_id}/archive")
def archive_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if conv:
        conv.archived = True
        db.commit()
    return {"success": True}

@router.post("/conversations/{conv_id}/duplicate")
def duplicate_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    src = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Conversation not found")

    new_id = f"conv_{uuid.uuid4().hex[:12]}"
    new_conv = Conversation(
        id=new_id,
        user_id=current_user.id,
        title=f"{src.title} (copy)",
        workspace=src.workspace,
        model=src.model,
        messages=list(src.messages or []),
        pinned=False,
        favorite=False,
        archived=False
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv.to_dict()
