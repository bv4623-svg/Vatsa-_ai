from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base

RATINGS = ("up", "down")
# Quick-pick reasons offered after a thumbs-down (fixed codes, so they can
# be counted and no free text -- or personal detail -- is stored).
REASONS = ("wrong", "unhelpful", "too_long", "unsafe", "other")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ChatFeedback(Base):
    """A 👍/👎 on one assistant reply. One row per user and message: voting
    again updates it, clearing the vote deletes it. message_id is the id the
    reply was saved under in conversations.messages (msg_…). Goes with the
    conversation (explicit cleanup + ON DELETE CASCADE) and the account."""
    __tablename__ = "chat_feedback"
    __table_args__ = (UniqueConstraint("user_id", "conversation_id", "message_id", name="uq_chat_feedback_message"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(String(64), nullable=False)
    rating = Column(String(8), nullable=False)
    reason = Column(String(32), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    def to_dict(self):
        return {"conversation_id": self.conversation_id, "message_id": self.message_id, "rating": self.rating, "reason": self.reason}
