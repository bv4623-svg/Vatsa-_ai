from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    # index=True: every lookup of a user's current/renewal subscription
    # filters by this column (payment_service.py's renewal and refund
    # checks) -- verified live (EXPLAIN ANALYZE) that this was a sequential
    # scan without it. Every other FK column in this schema already has an
    # index; this one was the one exception.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(String, nullable=False)
    order_id = Column(String, unique=True, index=True, nullable=True)
    payment_id = Column(String, unique=True, index=True, nullable=True)
    status = Column(String, default="pending")
    verified = Column(Boolean, default=False)
    amount = Column(String)
    currency = Column(String, default="INR")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="subscriptions")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan": self.plan,
            "order_id": self.order_id,
            "payment_id": self.payment_id,
            "status": self.status,
            "verified": self.verified,
            "amount": self.amount,
            "currency": self.currency,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }

