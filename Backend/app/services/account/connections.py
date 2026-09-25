import uuid
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token, decode_access_token
from app.models.connected_account import ConnectedAccount
from app.models.user import User

LINK_SCOPE = "oauth_link"


def create_link_state_token(user_id: int, provider: str) -> str:
    """Carries the current user's identity through the OAuth redirect
    round-trip (a link flow can't attach an Authorization header once
    the browser has navigated to the provider and back)."""
    return create_access_token(
        {"sub": str(user_id), "scope": LINK_SCOPE, "provider": provider},
        expires_delta=timedelta(minutes=10),
    )


def decode_link_state_token(state: str, expected_provider: str) -> Optional[int]:
    payload = decode_access_token(state)
    if not payload or payload.get("scope") != LINK_SCOPE or payload.get("provider") != expected_provider:
        return None
    sub = payload.get("sub")
    return int(sub) if sub and str(sub).isdigit() else None


def upsert_connection(db: Session, user_id: int, provider: str, provider_user_id: str, email: Optional[str]) -> ConnectedAccount:
    # A user can reach this explicit Settings -> link flow without ever
    # having logged in via this provider directly (get_or_create_oauth_user
    # only sets oauth_linked on a login match) -- an explicit, successful
    # link is equally strong proof of a working provider identity.
    db.query(User).filter(User.id == user_id, User.oauth_linked.is_(False)).update({"oauth_linked": True})

    existing = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == user_id, ConnectedAccount.provider == provider
    ).first()
    if existing:
        existing.provider_user_id = provider_user_id
        existing.provider_email = email
        db.commit()
        db.refresh(existing)
        return existing

    row = ConnectedAccount(id=uuid.uuid4().hex, user_id=user_id, provider=provider, provider_user_id=provider_user_id, provider_email=email)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
