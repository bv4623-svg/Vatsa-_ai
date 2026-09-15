from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

class TokenAccount(Base):
    __tablename__ = 'token_accounts'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True, nullable=False)
    balance = Column(Integer, default=50000, nullable=False)
    total_purchased = Column(Integer, default=0, nullable=False)
    total_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='token_account')

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'balance': self.balance,
            'total_purchased': self.total_purchased,
            'total_used': self.total_used,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class TokenTransaction(Base):
    __tablename__ = 'token_transactions'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    type = Column(String(30), nullable=False)  # 'bonus', 'purchase', 'usage', 'adjustment'
    amount = Column(Integer, nullable=False)   # +credit / -debit
    balance_after = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=True)
    reference_id = Column(String(255), nullable=True, index=True)
    model = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship('User', back_populates='token_transactions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'amount': self.amount,
            'balance_after': self.balance_after,
            'reason': self.reason,
            'reference_id': self.reference_id,
            'model': self.model,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
