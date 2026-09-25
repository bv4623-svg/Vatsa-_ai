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
    google_id = Column(String, unique=True, nullable=True)  # dead: OAuth login matches by email, never set/read

    # True the moment this account has a proven Google/GitHub identity --
    # set at creation for an OAuth signup, or the first time an existing
    # password account logs in via OAuth with the same (provider-verified)
    # email. Existing password-only accounts start false; the pending
    # "link your account" gate (alongside onboarding) uses this to decide
    # who still needs to migrate off password login.
    oauth_linked = Column(Boolean, nullable=False, default=False)

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

    # Bumped by POST /api/account/sessions/sign-out-others to invalidate
    # every access token issued before that moment (see auth/jwt.py and
    # auth/dependencies.py) -- a token with no "tv" claim at all predates
    # this feature and is grandfathered in as valid.
    token_version = Column(Integer, nullable=False, default=0)

    # Soft delete: is_active=False blocks login/get_current_user
    # immediately; a daily job hard-deletes rows past the grace period
    # (see app/services/account/deletion.py).
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Two-factor auth (TOTP). backup_codes stores hashes only, never the
    # plaintext codes shown to the user once at generation time.
    totp_secret = Column(String, nullable=True)
    two_factor_enabled = Column(Boolean, nullable=False, default=False)
    backup_codes = Column(JSON, nullable=True, default=list)

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
            "twoFactorEnabled": self.two_factor_enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }