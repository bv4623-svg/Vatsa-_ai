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
    if payload.get("scope"):
        # Scoped tokens (e.g. the media-view token minted for <img src>
        # URLs) must never be usable as a full session credential --
        # normal login tokens never carry a "scope" claim.
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
    # "tv" (token_version) is only present on tokens minted after the
    # sign-out-other-devices feature shipped -- a token with no "tv"
    # claim at all predates it and is grandfathered in as valid, so
    # every session issued before this change keeps working unchanged.
    if "tv" in payload and payload["tv"] != user.token_version:
        raise credentials_exception
    return user
