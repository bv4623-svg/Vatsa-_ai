# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)   # optional display name
    full_name = Column(String, nullable=True)                           # optional, from Google or user

    # Password is nullable to support OTP / Google OAuth users
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True)

    # Status flags
    is_verified = Column(Boolean, default=False)      # email verified?
    is_active = Column(Boolean, default=True)         # account active?

    # Onboarding fields
    birth_month = Column(Integer, nullable=True)      # 1-12
    birth_year = Column(Integer, nullable=True)
    profile_completed = Column(Boolean, default=False)

    # Account tier
    tier = Column(String, default="free")

    # Preferences / settings
    settings = Column(JSON, default={})

    # Timestamps (timezone-aware)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("Memory", back_populates="user", cascade="all, delete-orphan")
    token_account = relationship("TokenAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
    token_transactions = relationship("TokenTransaction", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name or (self.email.split("@")[0] if self.email else "User"),
            "tier": self.tier or "free",
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "profile_completed": self.profile_completed,
            "settings": self.settings or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }