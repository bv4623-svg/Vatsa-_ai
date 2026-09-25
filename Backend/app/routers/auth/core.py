from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.utils.rate_limit import client_ip, enforce_rate_limit, reset_rate_limit

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount
from app.auth.jwt import verify_password, needs_rehash, get_password_hash, create_access_token
from app.auth.dependencies import get_current_user
from app.routers.auth.schemas import LoginRequest, OnboardingRequest
from sqlalchemy.orm.attributes import flag_modified
from typing import Any, Dict
from app.services.feature_access import user_tier, check_daily_limit, check_project_limit
from app.utils.cache import cache_get, cache_set, cache_delete

router = APIRouter(tags=["authentication"])

_PROFILE_CACHE_TTL_SECONDS = 60


def _profile_cache_key(user_id: int) -> str:
    return f"profile:{user_id}"


# ═══════════════════════════════════════════════════════════
# REGISTER / LOGIN
# ═══════════════════════════════════════════════════════════
@router.post("/auth/register")
@router.post("/api/auth/register")
@router.post("/api/auth/signup")
def register():
    """Email/password sign-up is permanently retired -- new accounts are
    Google/GitHub only (see app/routers/auth/oauth/). 410 Gone, not 404: the
    resource existed and was intentionally removed, which is exactly what
    410 means and lets old frontend builds/bookmarks show a real message
    instead of a generic "not found"."""
    raise HTTPException(
        status_code=410,
        detail="Email/password sign-up is no longer available. Please continue with Google or GitHub.",
    )


@router.post("/auth/login")
@router.post("/api/auth/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    # Throttle per-IP and per-account so neither a single source nor a
    # single target can be brute-forced.
    ip = client_ip(request)
    enforce_rate_limit(f"login:ip:{ip}", limit=5, window_seconds=900)
    enforce_rate_limit(f"login:email:{email}", limit=5, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    reset_rate_limit(f"login:ip:{ip}")
    reset_rate_limit(f"login:email:{email}")

    # Legacy pbkdf2_sha256 hashes are upgraded to bcrypt transparently now
    # that the plaintext password is known-correct -- no forced reset.
    # Committed immediately since the 2FA branch below returns early.
    if needs_rehash(user.hashed_password):
        user.hashed_password = get_password_hash(req.password)
        db.commit()

    if user.two_factor_enabled:
        # Password verified, but no real session token yet -- the
        # pending token only carries scope="2fa_pending" (rejected by
        # get_current_user like every other scoped token) and is
        # exchanged for a real one by POST /auth/2fa/verify-login.
        pending_token = create_access_token({"sub": str(user.id), "scope": "2fa_pending"}, expires_delta=timedelta(minutes=10))
        return {"requires_2fa": True, "pending_token": pending_token}

    user.last_login = datetime.utcnow()
    db.commit()

    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    if not token_acc:
        db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
        db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier or "free",
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }


@router.post("/auth/token")
@router.post("/api/auth/token")
def login_form(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2-password-form login for interactive /docs use only. Held to
    the same bar as POST /auth/login -- it must not be a way to skip rate
    limiting, the deactivated-account check, or a 2FA requirement."""
    email = form_data.username.lower().strip()
    ip = client_ip(request)
    enforce_rate_limit(f"login:ip:{ip}", limit=5, window_seconds=900)
    enforce_rate_limit(f"login:email:{email}", limit=5, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")
    if user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="This account has 2FA enabled -- use POST /auth/login instead")

    reset_rate_limit(f"login:ip:{ip}")
    reset_rate_limit(f"login:email:{email}")

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {"access_token": token, "token_type": "bearer"}


# ═══════════════════════════════════════════════════════════
# PROFILE / ME
# ═══════════════════════════════════════════════════════════
@router.get("/auth/me")
@router.get("/api/auth/me")
@router.get("/api/profile")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Short TTL (see _PROFILE_CACHE_TTL_SECONDS), not fully invalidated on
    # every write: token balance and daily usage counts here change from
    # many call sites across the app (every chat/code/image/search request,
    # every payment) -- invalidating this cache from all of them would be
    # a large, risky blast radius for a field that's already fine to show
    # up to a minute stale. update_settings/complete_onboarding below (the
    # two writes that live in this same file) still invalidate explicitly,
    # since those should feel instant.
    cache_key = _profile_cache_key(user.id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    balance = token_acc.balance if token_acc else 50000
    tier = user_tier(user)
    # chat_messages/code_messages are gone -- chat is unlimited on every
    # tier now, so there's no daily count worth reporting for it.
    usage = {}
    for feature in ("image_gen", "web_search"):
        _, used, limit = check_daily_limit(db, user, feature)
        usage[feature] = {"used": used, "limit": limit}
    _, projects_used, projects_limit = check_project_limit(db, user)
    usage["code_apps"] = {"used": projects_used, "limit": projects_limit}
    result = {
        "id": user.id, "email": user.email,
        "name": user.full_name or user.email.split("@")[0],
        "full_name": user.full_name or user.email.split("@")[0],
        "username": user.username, "tier": tier,
        "is_active": user.is_active, "is_verified": user.is_verified,
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
        "tokens": balance, "token_balance": balance,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "usage": usage,
        "settings": user.settings or {},
        "twoFactorEnabled": user.two_factor_enabled,
    }
    cache_set(cache_key, result, _PROFILE_CACHE_TTL_SECONDS)
    return result


@router.patch("/auth/settings")
@router.patch("/api/auth/settings")
def update_settings(
    payload: Dict[str, Any],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Merges a partial settings patch into the user's profile so
    preferences (theme, language, timezone, notifications) follow them
    across devices. The client validates against src/config/settings.ts;
    unknown keys are rejected here so the column cannot be used as
    arbitrary storage."""
    allowed = {
        "theme", "language", "timezone", "defaultModel", "responseStyle",
        "autoSaveChats", "historyRetention", "notifyEmail", "notifyInApp",
        "notifyQuotaWarnings", "notifyProductUpdates",
    }
    unknown = set(payload) - allowed
    if unknown:
        raise HTTPException(400, f"Unknown setting(s): {', '.join(sorted(unknown))}")

    merged = dict(user.settings or {})
    merged.update(payload)
    user.settings = merged
    # JSON columns need an explicit reassign for SQLAlchemy to see the change.
    flag_modified(user, "settings")
    db.commit()
    db.refresh(user)
    cache_delete(_profile_cache_key(user.id))
    return {"settings": user.settings}


# ═══════════════════════════════════════════════════════════
# ONBOARDING
# ═══════════════════════════════════════════════════════════
@router.get("/auth/onboarding")
@router.get("/api/auth/onboarding")
def get_onboarding_status(user: User = Depends(get_current_user)):
    return {
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
    }


@router.post("/auth/onboarding")
@router.post("/api/auth/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.birth_month is not None: user.birth_month = req.birth_month
    if req.birth_year is not None:  user.birth_year  = req.birth_year
    if req.preferences:
        settings = dict(user.settings or {})
        settings.update(req.preferences)
        user.settings = settings
    user.profile_completed = True
    db.commit()
    db.refresh(user)
    cache_delete(_profile_cache_key(user.id))
    return {"success": True, "message": "Onboarding completed", "user": user.to_dict()}
