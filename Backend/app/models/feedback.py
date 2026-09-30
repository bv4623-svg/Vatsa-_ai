from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base

FEEDBACK_TYPES = ("bug", "feature", "praise", "other")
FEEDBACK_STATUSES = ("new", "read", "resolved")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Feedback(Base):
    """In-app feedback. user_id is empty for signed-out senders, who may
    leave an email instead; a deleted account keeps its feedback, unlinked."""
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String(254), nullable=True)
    type = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)
    page_url = Column(String(2048), nullable=True)
    user_agent = Column(String(512), nullable=True)
    status = Column(String(20), nullable=False, default="new", index=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email": self.email,
            "type": self.type,
            "message": self.message,
            "rating": self.rating,
            "page_url": self.page_url,
            "user_agent": self.user_agent,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
