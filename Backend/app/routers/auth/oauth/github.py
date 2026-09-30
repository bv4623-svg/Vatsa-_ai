import os
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth.oauth.shared import (
    get_or_create_oauth_user, redirect_status, redirect_with_error, redirect_with_token, refuse_without_captcha,
)
from app.routers.auth.oauth.state import generate_oauth_state, set_oauth_state_cookie, verify_oauth_state, oauth_state_cookie_name

router = APIRouter(tags=["authentication"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "")


@router.get("/auth/github/login")
@router.get("/api/auth/github/login")
@router.post("/auth/github/login")
@router.post("/api/auth/github/login")
async def github_login(request: Request):
    # POST is what the sign-in buttons send (with the CAPTCHA token in the
    # body, never the URL); GET still works while the CAPTCHA is off.
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return redirect_with_error("github_not_configured", redirect_status(request))
    refused = await refuse_without_captcha(request)
    if refused:
        return refused

    state = generate_oauth_state()
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }
    response = RedirectResponse("https://github.com/login/oauth/authorize?" + urlencode(params), status_code=redirect_status(request))
    set_oauth_state_cookie(request, response, "github", state)
    return response


@router.get("/auth/github/callback")
@router.get("/api/auth/github/callback")
async def github_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)):
    if not verify_oauth_state(request, state, "github"):
        return redirect_with_error("invalid_state")

    async with httpx.AsyncClient() as client:
        tok = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code, "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )
        access_token = tok.json().get("access_token")
        if not access_token:
            return redirect_with_error("github_token_failed")

        headers = {"Authorization": f"Bearer {access_token}"}
        res = await client.get("https://api.github.com/user", headers=headers)
        info = res.json()

        email = info.get("email")
        verified = True  # GitHub's /user email is only exposed if already verified
        if not email:
            er = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = er.json() if isinstance(er.json(), list) else []
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                None,
            )
            email = primary.get("email") if primary else None
            verified = bool(primary)

    if not email or not verified:
        return redirect_with_error("github_no_email")
    name = info.get("name") or info.get("login") or email.split("@")[0]

    user = get_or_create_oauth_user(db, email, name, "github")
    final = redirect_with_token(user)
    final.delete_cookie(oauth_state_cookie_name("github"))
    return final
