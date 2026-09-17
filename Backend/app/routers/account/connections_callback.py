import os
from typing import Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from fastapi import Depends

from app.database import get_db
from app.services.account import decode_link_state_token, upsert_connection
from app.routers.account.connections import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_LINK_REDIRECT_URI,
    GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_LINK_REDIRECT_URI,
)

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000")


async def _fetch_google_identity(code: str) -> Tuple[str, Optional[str]]:
    async with httpx.AsyncClient() as client:
        tok = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_LINK_REDIRECT_URI, "grant_type": "authorization_code",
        })
        access_token = tok.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=502, detail="Google token exchange failed")
        res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {access_token}"})
        info = res.json()
    return str(info.get("id")), info.get("email")


async def _fetch_github_identity(code: str) -> Tuple[str, Optional[str]]:
    async with httpx.AsyncClient() as client:
        tok = await client.post(
            "https://github.com/login/oauth/access_token", headers={"Accept": "application/json"},
            data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, "code": code, "redirect_uri": GITHUB_LINK_REDIRECT_URI},
        )
        access_token = tok.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=502, detail="GitHub token exchange failed")
        headers = {"Authorization": f"Bearer {access_token}"}
        res = await client.get("https://api.github.com/user", headers=headers)
        info = res.json()
        email = info.get("email")
        if not email:
            er = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = er.json() if isinstance(er.json(), list) else []
            primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
            email = primary.get("email") if primary else None
    return str(info.get("id")), email


@router.get("/auth/{provider}/link/callback")
async def link_callback(provider: str, code: str, state: str, db: Session = Depends(get_db)):
    if provider not in ("google", "github"):
        raise HTTPException(status_code=404, detail="Unknown provider")
    user_id = decode_link_state_token(state, provider)
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/settings?connect_error=invalid_state")

    provider_user_id, email = await (_fetch_google_identity(code) if provider == "google" else _fetch_github_identity(code))
    upsert_connection(db, user_id, provider, provider_user_id, email)
    return RedirectResponse(f"{FRONTEND_URL}/settings?connected={provider}")
