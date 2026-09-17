from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class ConnectedAccount(Base):
    """An OAuth provider linked to an already-signed-in user (Settings >
    Connected accounts), distinct from OAuth-as-login in
    app/routers/auth/oauth.py -- that flow only matches by email and
    never persists a provider id. Linking reuses the same provider
    callback with a signed "link" state (see
    app/services/account/connections.py) so it never needs its own
    OAuth app registration.
    """
    __tablename__ = "connected_accounts"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_connected_account_user_provider"),)

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    provider = Column(String(20), nullable=False)  # "google" | "github"
    provider_user_id = Column(String(200), nullable=False)
    provider_email = Column(String(255), nullable=True)

    connected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "provider": self.provider,
            "email": self.provider_email,
            "connectedAt": self.connected_at.isoformat() if self.connected_at else None,
        }
