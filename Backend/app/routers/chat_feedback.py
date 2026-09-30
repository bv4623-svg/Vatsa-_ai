"""👍/👎 on assistant replies, saved per user and message so they survive a
reload and can be counted (Phase 0 Fix 3). Admin numbers live at
/api/admin/chat-feedback/stats -- named apart from the site-feedback admin
(/api/feedback, routers/feedback.py)."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.dependencies.admin import require_admin
from app.database import get_db
from app.models.chat_feedback import ChatFeedback
from app.models.conversation import Conversation
from app.models.user import User
from app.services import chat_feedback as votes
from app.utils.rate_limit import enforce_rate_limit

router = APIRouter(tags=["chat feedback"])

Reason = Literal["wrong", "unhelpful", "too_long", "unsafe", "other"]


class VoteIn(BaseModel):
    conversation_id: str = Field(..., min_length=1, max_length=64)
    message_id: str = Field(..., min_length=1, max_length=64)
    rating: Literal["up", "down"]
    reason: Optional[Reason] = None


def _require_own_reply(db: Session, user: User, conversation_id: str, message_id: str) -> None:
    """Votes are only for replies (not the user's own messages) saved in the
    voter's own conversation. Anything else looks like "not found"."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user.id).first()
    found = conv is not None and any(
        isinstance(m, dict) and m.get("id") == message_id and m.get("role") == "assistant" for m in (conv.messages or [])
    )
    if not found:
        raise HTTPException(status_code=404, detail="Message not found")


@router.post("/api/chat/feedback")
def rate_reply(req: VoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(f"chat-feedback:{user.id}", limit=60, window_seconds=60)
    _require_own_reply(db, user, req.conversation_id, req.message_id)
    return votes.save_vote(db, user.id, req.conversation_id, req.message_id, req.rating, req.reason).to_dict()


@router.delete("/api/chat/feedback")
def clear_rating(
    conversation_id: str = Query(..., min_length=1, max_length=64),
    message_id: str = Query(..., min_length=1, max_length=64),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"chat-feedback:{user.id}", limit=60, window_seconds=60)
    votes.clear_vote(db, user.id, conversation_id, message_id)
    return {"conversation_id": conversation_id, "message_id": message_id, "rating": None, "reason": None}


@router.get("/api/chat/feedback")
def my_ratings(
    conversation_id: str = Query(..., min_length=1, max_length=64),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(ChatFeedback).filter_by(user_id=user.id, conversation_id=conversation_id).all()
    return {"items": [r.to_dict() for r in rows]}


@router.get("/api/admin/chat-feedback/stats")
def rating_stats(days: int = Query(30, ge=1, le=365), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    enforce_rate_limit(f"admin-chat-feedback:{admin.id}", limit=60, window_seconds=60)
    return votes.stats(db, days)
