import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth.oauth.shared import get_or_create_oauth_user, redirect_with_token, redirect_with_error
from app.routers.auth.oauth.state import generate_oauth_state, set_oauth_state_cookie, verify_oauth_state, oauth_state_cookie_name

router = APIRouter(tags=["authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")


@router.get("/auth/google/login")
@router.get("/api/auth/google/login")
def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return redirect_with_error("google_not_configured")

    state = generate_oauth_state()
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    response = RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))
    set_oauth_state_cookie(request, response, "google", state)
    return response


@router.get("/auth/google/callback")
@router.get("/api/auth/google/callback")
async def google_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)):
    if not verify_oauth_state(request, state, "google"):
        return redirect_with_error("invalid_state")

    async with httpx.AsyncClient() as client:
        tok = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        access_token = tok.json().get("access_token")
        if not access_token:
            return redirect_with_error("google_token_failed")

        res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("email") or "").lower().strip()
    if not email:
        return redirect_with_error("google_no_email")
    # Google sets this false for an email Google itself hasn't confirmed
    # belongs to the account holder -- trusting it would let anyone sign
    # in as any address they merely typed into their Google profile.
    if not info.get("verified_email", False):
        return redirect_with_error("google_email_not_verified")
    name = info.get("name") or email.split("@")[0]

    user = get_or_create_oauth_user(db, email, name, "google")
    final = redirect_with_token(user)
    final.delete_cookie(oauth_state_cookie_name("google"))
    return final
