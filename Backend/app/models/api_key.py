from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class ApiKey(Base):
    """A user-generated API key for external API access. Only a SHA-256
    hash of the key is ever stored -- the plaintext is shown to the user
    exactly once, at creation, the same way GitHub/Stripe-style API keys
    work. See app.services.account.api_keys for generation/verification.
    """
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    key_prefix = Column(String(12), nullable=False)  # shown in lists so a key is recognizable without the secret
    key_hash = Column(String(64), nullable=False, unique=True, index=True)  # sha256 hex digest

    last_used_at = Column(DateTime(timezone=True), nullable=True)
    revoked = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "keyPrefix": self.key_prefix,
            "lastUsedAt": self.last_used_at.isoformat() if self.last_used_at else None,
            "revoked": self.revoked,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
