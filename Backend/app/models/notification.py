from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    """A real in-app notification row, gated on the user's own
    notifyInApp preference at creation time (see
    app/services/account/notify.py) -- never fabricated content, only
    for events the backend actually produced (a scheduled task finishing,
    a storage warning)."""
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    type = Column(String(40), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    read = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "read": self.read,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
