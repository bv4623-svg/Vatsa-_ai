from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class ContactMessage(Base):
    """A message submitted through the public /contact page form. The row
    is the durable record; the notification email (see app/routers/contact.py)
    is best-effort on top of it, not the source of truth."""
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(320), nullable=False, index=True)
    interest = Column(String(200), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "interest": self.interest,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
