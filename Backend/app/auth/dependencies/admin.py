import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies.core import get_current_user, security
from app.auth.jwt import decode_access_token
from app.models.user import User


def admin_emails() -> set:
    """Addresses allowed to use admin endpoints, from ADMIN_EMAILS
    (comma-separated). Unset or empty means nobody is an admin."""
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    user: User = Depends(get_current_user),
) -> User:
    """Admin endpoints expose other people's data, so on top of a valid login
    they require, all of:
      - the account's email is listed in ADMIN_EMAILS and is verified;
      - a real session token that carries a token-version claim, so it can be
        revoked by "sign out other devices". API keys and the older tokens
        with no such claim are refused;
      - two-factor authentication turned on for the account.
    """
    if not user.is_verified or (user.email or "").strip().lower() not in admin_emails():
        raise HTTPException(status_code=403, detail="Admin access required")

    payload = decode_access_token(credentials.credentials) if credentials else None
    if not payload or "tv" not in payload:
        raise HTTPException(status_code=403, detail="Admin access requires a signed-in session, not an API key")

    if not user.two_factor_enabled:
        raise HTTPException(status_code=403, detail="Admin access requires two-factor authentication to be enabled on this account")

    return user
