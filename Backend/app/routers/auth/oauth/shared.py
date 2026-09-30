import logging
import os
import secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, create_access_token
from app.services.captcha import captcha_enabled, token_from_form, verify_turnstile
from app.utils.rate_limit import client_ip, enforce_rate_limit

captcha_logger = logging.getLogger("Captcha")

# Env FRONTEND_REDIRECT_URL, else the live site (see app/config/urls.py).
from app.config.urls import FRONTEND_URL  # noqa: E402


def get_or_create_oauth_user(db: Session, email: str, name: str, provider: str) -> User:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user:
        if not user.is_verified:
            # Email sign-up doesn't prove the inbox, so whoever set this password
            # may not own the address: the provider-verified owner takes the
            # account over, the unproven password stops working, its sessions end.
            user.hashed_password = get_password_hash(secrets.token_hex(24))
            user.token_version = (user.token_version or 0) + 1
            user.is_verified = True
        # A provider-verified email match is proof this person controls
        # this account too -- marks a legacy password-only account as
        # migrated off the "still needs to link a provider" safety-net
        # population without requiring the separate, explicit Settings ->
        # Connected accounts flow.
        if not user.oauth_linked:
            user.oauth_linked = True
            db.commit()
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
        oauth_linked=True,
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


def redirect_with_token(user: User) -> RedirectResponse:
    if user.two_factor_enabled:
        # The provider proved the email, not the second factor. Same as
        # password login: only a pending token (scope="2fa_pending", refused
        # as a session) that POST /auth/2fa/verify-login exchanges for one.
        pending_token = create_access_token({"sub": str(user.id), "scope": "2fa_pending"}, expires_delta=timedelta(minutes=10))
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{urlencode({'requires_2fa': 'true', 'pending_token': pending_token})}")
    jwt_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    qs = urlencode({
        "access_token": jwt_token,
        "email": user.email,
        "full_name": user.full_name or "",
        "tier": user.tier or "free",
        "profile_completed": "true" if user.profile_completed else "false",
    })
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{qs}")


def redirect_with_error(error: str, status_code: int = 307) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error}", status_code=status_code)


def redirect_status(request: Request) -> int:
    """303 after the form POST that starts a sign-in, so the browser follows
    with a GET; a 307 would re-send the POST (to Google/GitHub, or to the
    frontend's callback page)."""
    return 303 if request.method == "POST" else 307


async def refuse_without_captcha(request: Request) -> Optional[RedirectResponse]:
    """The CAPTCHA gate for starting a Google/GitHub sign-in -- the only
    place the app asks for one. None means go ahead. With the CAPTCHA on, a
    start without a token (including the plain GET) is refused, so neither
    /signup nor a direct link skips it."""
    if not captcha_enabled():
        return None
    status = redirect_status(request)
    ip = client_ip(request)
    token = token_from_form(await request.form()) if request.method == "POST" else None
    if not token:
        captcha_logger.info("captcha missing: ip=%s", ip)
        return redirect_with_error("captcha_required", status)
    try:
        # Caps the calls to Cloudflare, not sign-ins: a person needs one.
        enforce_rate_limit(f"captcha:ip:{ip}", limit=10, window_seconds=60)
    except HTTPException:
        return redirect_with_error("too_many_attempts", status)
    if not await verify_turnstile(token, ip, request.headers.get("user-agent", "")):
        return redirect_with_error("captcha_failed", status)
    return None
