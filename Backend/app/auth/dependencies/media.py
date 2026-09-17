from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.auth.jwt import decode_access_token
from app.auth.dependencies.core import security


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
