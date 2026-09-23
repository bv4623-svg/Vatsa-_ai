from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import Any, Dict

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount
from app.auth.dependencies import get_current_user
from app.services.feature_access import user_tier, check_daily_limit
from app.routers.auth.core.router import router


# ═══════════════════════════════════════════════════════════
# PROFILE / ME
# ═══════════════════════════════════════════════════════════
@router.get("/auth/me")
@router.get("/api/auth/me")
@router.get("/api/profile")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    balance = token_acc.balance if token_acc else 50000
    tier = user_tier(user)
    usage = {}
    for feature in ("chat_messages", "code_messages", "image_gen", "web_search"):
        _, used, limit = check_daily_limit(db, user, feature)
        usage[feature] = {"used": used, "limit": limit}
    return {
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
    return {"settings": user.settings}
