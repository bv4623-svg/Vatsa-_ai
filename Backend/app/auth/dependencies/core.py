from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.auth.jwt import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials or not credentials.credentials:
        raise credentials_exception

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        # Not a valid JWT at all -- try it as an API key before giving
        # up. Imported here (not at module load) to avoid a circular
        # import: app.services.account.api_keys doesn't need this module,
        # but keeping the dependency direction one-way is simpler to audit.
        from app.services.account.api_keys import verify_api_key
        user = verify_api_key(db, token)
        if user:
            return user
        raise credentials_exception
    if payload.get("scope") or payload.get("purpose"):
        # Scoped tokens (the media-view token for <img src>, the 2FA
        # pending token) and single-purpose tokens (the password-reset
        # token) must never be usable as a full session credential --
        # normal login tokens carry neither claim.
        raise credentials_exception

    sub = payload.get("sub")
    email = payload.get("email") or (sub if isinstance(sub, str) and "@" in sub else None)
    user_id = payload.get("user_id") or (int(sub) if isinstance(sub, int) or (isinstance(sub, str) and str(sub).isdigit()) else None)

    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    # Every session token carries "tv" (token_version); bumping it on the
    # user (password reset, sign-out-everywhere, force reset) revokes all
    # of their sessions. A token without it can't be revoked, so it isn't
    # a session.
    if payload.get("tv") != user.token_version:
        raise credentials_exception
    return user
