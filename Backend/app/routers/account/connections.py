import os
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.connected_account import ConnectedAccount
from app.auth.dependencies import get_current_user
from app.services.account import create_link_state_token

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_LINK_REDIRECT_URI = os.getenv("GOOGLE_LINK_REDIRECT_URI") or os.getenv("GOOGLE_REDIRECT_URI", "")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_LINK_REDIRECT_URI = os.getenv("GITHUB_LINK_REDIRECT_URI") or os.getenv("GITHUB_REDIRECT_URI", "")


@router.get("/api/account/connections")
def list_connections(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user.id).all()
    return {"items": [r.to_dict() for r in rows]}


@router.get("/api/account/connections/{provider}/start")
def start_link(provider: str, user: User = Depends(get_current_user)):
    if provider not in ("google", "github"):
        raise HTTPException(status_code=404, detail="Unknown provider")
    if provider == "google" and not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="Google linking is not configured on this server")
    if provider == "github" and not (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub linking is not configured on this server")

    state = create_link_state_token(user.id, provider)
    if provider == "google":
        params = {
            "client_id": GOOGLE_CLIENT_ID, "redirect_uri": GOOGLE_LINK_REDIRECT_URI,
            "response_type": "code", "scope": "openid email profile", "state": state,
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    else:
        params = {"client_id": GITHUB_CLIENT_ID, "redirect_uri": GITHUB_LINK_REDIRECT_URI, "scope": "read:user user:email", "state": state}
        url = "https://github.com/login/oauth/authorize?" + urlencode(params)
    return {"url": url}


@router.delete("/api/account/connections/{provider}")
def unlink(provider: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user.id, ConnectedAccount.provider == provider).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not connected")
    db.delete(row)
    db.commit()
    return {"unlinked": True}
