from fastapi import Depends, HTTPException, Query, status
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
    return user

def get_user_for_media(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Identity check for endpoints loaded via <img src="..."> -- browsers
    never attach an Authorization header to those requests, so this
    accepts a token via ?token= as well. Only ever mint tokens for this
    via create_media_token() (scope="media"), never the main session
    token: a leaked media token (referrer headers, browser history)
    can't be replayed against any other endpoint, since every other
    route only checks get_current_user's header path.
    """
    raw = (credentials.credentials if credentials else None) or token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(raw)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # A header-supplied token is the normal session token (no "scope"
    # claim); a query-supplied one must be a media-scoped token.
    if token and not credentials:
        if payload.get("scope") != "media":
            raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    user_id = payload.get("user_id") or (int(sub) if isinstance(sub, str) and sub.isdigit() else None)
    user = db.query(User).filter(User.id == user_id).first() if user_id else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None

