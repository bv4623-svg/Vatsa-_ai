from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import urlencode
import os
import secrets
import httpx

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, create_access_token

router = APIRouter(tags=["authentication"])

# ── ENV ────────────────────────────────────────────────────
FRONTEND_URL         = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000")
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "")
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI  = os.getenv("GITHUB_REDIRECT_URI", "")
MS_CLIENT_ID         = os.getenv("MICROSOFT_CLIENT_ID", "")
MS_CLIENT_SECRET     = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MS_TENANT            = os.getenv("MICROSOFT_TENANT", "common")
MS_REDIRECT_URI      = os.getenv("MICROSOFT_REDIRECT_URI", "")


# ═══════════════════════════════════════════════════════════
# OAUTH — Shared helpers
# ═══════════════════════════════════════════════════════════
def _get_or_create_oauth_user(db: Session, email: str, name: str, provider: str):
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    base_username = email.split("@")[0] + "_" + provider
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    user = User(
        email=email, full_name=name,
        username=username,
        hashed_password=get_password_hash(secrets.token_hex(24)),
        is_active=True, is_verified=True,
        profile_completed=False, tier="free",
    )
    db.add(user)
    db.flush()  # assigns user.id within the same transaction, without committing yet

    db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=50000,
        balance_after=50000, reason=f"Welcome bonus via {provider}",
    ))
    db.commit()
    db.refresh(user)
    return user


def _redirect_with_token(user: User):
    jwt_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    qs = urlencode({
        "access_token": jwt_token,
        "email": user.email,
        "full_name": user.full_name or "",
        "tier": user.tier or "free",
        "profile_completed": "true" if user.profile_completed else "false",
    })
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{qs}")


# ═══════════════════════════════════════════════════════════
# GOOGLE OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/google/login")
@router.get("/api/auth/google/login")
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(500, "Google OAuth not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))


@router.get("/auth/google/callback")
@router.get("/api/auth/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        tok = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        access_token = tok.json().get("access_token")
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=google_token_failed")

        res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("email") or "").lower().strip()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=google_no_email")
    name = info.get("name") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "google")
    return _redirect_with_token(user)


# ═══════════════════════════════════════════════════════════
# GITHUB OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/github/login")
@router.get("/api/auth/github/login")
def github_login():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(500, "GitHub OAuth not configured")
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
    }
    return RedirectResponse("https://github.com/login/oauth/authorize?" + urlencode(params))


@router.get("/auth/github/callback")
@router.get("/api/auth/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
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
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=github_token_failed")

        headers = {"Authorization": f"Bearer {access_token}"}
        res = await client.get("https://api.github.com/user", headers=headers)
        info = res.json()

        email = info.get("email")
        if not email:
            er = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = er.json() if isinstance(er.json(), list) else []
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                emails[0] if emails else None,
            )
            email = primary.get("email") if primary else None

    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=github_no_email")
    name = info.get("name") or info.get("login") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "github")
    return _redirect_with_token(user)


# ═══════════════════════════════════════════════════════════
# MICROSOFT OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/microsoft/login")
@router.get("/api/auth/microsoft/login")
def microsoft_login():
    if not MS_CLIENT_ID or not MS_CLIENT_SECRET:
        raise HTTPException(500, "Microsoft OAuth not configured")
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": "openid email profile User.Read",
    }
    url = f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/authorize?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/auth/microsoft/callback")
@router.get("/api/auth/microsoft/callback")
async def microsoft_callback(code: str, db: Session = Depends(get_db)):
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
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=microsoft_token_failed")

        res = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("mail") or info.get("userPrincipalName") or "").lower().strip()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=microsoft_no_email")
    name = info.get("displayName") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "microsoft")
    return _redirect_with_token(user)
