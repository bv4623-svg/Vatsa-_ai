from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base
import enum
import bcrypt
from datetime import datetime, timedelta


class OTPPurpose(str, enum.Enum):
    SIGNUP = "signup"
    LOGIN  = "login"
    RESET  = "reset"


class OTP(Base):
    __tablename__ = "otps"

    id                 = Column(Integer, primary_key=True, index=True)
    email              = Column(String, index=True, nullable=False)
    code_hash          = Column(String, nullable=False)             # bcrypt hash
    purpose            = Column(String(20), nullable=False, default="signup")
    expires_at         = Column(DateTime, nullable=False)
    is_verified        = Column(Boolean, default=False)
    is_used            = Column(Boolean, default=False)
    attempts           = Column(Integer, default=0)
    resend_count       = Column(Integer, default=0)
    verification_token = Column(String, unique=True, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_otp_email', 'email'),
        Index('idx_otp_expires', 'expires_at'),
        Index('idx_otp_email_purpose', 'email', 'purpose'),
    )

    def __repr__(self):
        return f"<OTP(email={self.email}, purpose={self.purpose}, used={self.is_used})>"

    # ── Helpers ──────────────────────────────────────────────
    @property
    def is_expired(self) -> bool:
        return self.expires_at < datetime.utcnow()

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_verified and not self.is_expired

    def mark_as_verified(self):
        self.is_verified = True
        self.updated_at = datetime.utcnow()

    def mark_as_used(self):
        self.is_used = True
        self.updated_at = datetime.utcnow()

    # ── Factory ──────────────────────────────────────────────
    @classmethod
    def create_otp(cls, email: str, purpose: str, plain_code: str,
                   expires_in_minutes: int = 5):
        hashed = bcrypt.hashpw(
            plain_code.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        return cls(
            email=email.lower().strip(),
            code_hash=hashed,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(minutes=expires_in_minutes),
            is_verified=False,
            is_used=False,
            attempts=0,
            resend_count=0,
        )

    def verify_code(self, plain_code: str) -> bool:
        try:
            return bcrypt.checkpw(
                plain_code.encode("utf-8"),
                self.code_hash.encode("utf-8"),
            )
        except Exception:
            return False