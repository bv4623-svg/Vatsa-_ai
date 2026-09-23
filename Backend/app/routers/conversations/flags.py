from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.routers.conversations.router import router


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
