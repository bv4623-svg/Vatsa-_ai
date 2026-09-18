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

MS_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MS_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MS_TENANT = os.getenv("MICROSOFT_TENANT", "common")
MS_REDIRECT_URI = os.getenv("MICROSOFT_REDIRECT_URI", "")


@router.get("/auth/microsoft/login")
@router.get("/api/auth/microsoft/login")
def microsoft_login(request: Request):
    if not MS_CLIENT_ID or not MS_CLIENT_SECRET:
        return redirect_with_error("microsoft_not_configured")

    state = generate_oauth_state()
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": "openid email profile User.Read",
        "state": state,
    }
    url = f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/authorize?" + urlencode(params)
    response = RedirectResponse(url)
    set_oauth_state_cookie(request, response, "microsoft", state)
    return response


@router.get("/auth/microsoft/callback")
@router.get("/api/auth/microsoft/callback")
async def microsoft_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)):
    if not verify_oauth_state(request, state, "microsoft"):
        return redirect_with_error("invalid_state")

    async with httpx.AsyncClient() as client:
        tok = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
            data={
                "client_id": MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "code": code, "redirect_uri": MS_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        access_token = tok.json().get("access_token")
        if not access_token:
            return redirect_with_error("microsoft_token_failed")

        res = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("mail") or info.get("userPrincipalName") or "").lower().strip()
    if not email:
        return redirect_with_error("microsoft_no_email")
    name = info.get("displayName") or email.split("@")[0]

    user = get_or_create_oauth_user(db, email, name, "microsoft")
    final = redirect_with_token(user)
    final.delete_cookie(oauth_state_cookie_name("microsoft"))
    return final
