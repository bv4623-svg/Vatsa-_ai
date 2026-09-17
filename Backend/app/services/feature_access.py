"""
Central free/pro/ultra feature-access and daily-limit definitions.
Every gated endpoint should go through require_feature() (a FastAPI
dependency, not a decorator -- see note below) rather than checking
user.tier directly, so limits/access stay in one place.

Note on tier values: the existing payment/registration code predates
the ultra tier and has historically written "pro", "paid", or
"premium" for a paid account (see payment_service.py, token_service.py).
user_tier() normalizes all three legacy values to "pro" so this system
works with data written before this file existed, without requiring a
migration.
"""
from datetime import date
from typing import Dict, Tuple
from fastapi import Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.usage_daily import UsageDaily
from app.auth.dependencies import get_current_user

FEATURE_ACCESS: Dict[str, Dict[str, bool]] = {
    "chat_basic":        {"free": True,  "pro": True,  "ultra": True},
    "chat_streaming":    {"free": True,  "pro": True,  "ultra": True},
    "web_search":        {"free": True,  "pro": True,  "ultra": True},
    "memory":            {"free": True,  "pro": True,  "ultra": True},
    "history":           {"free": True,  "pro": True,  "ultra": True},
    "vision":            {"free": False, "pro": True,  "ultra": True},
    "tts":               {"free": False, "pro": True,  "ultra": True},
    "reasoning":         {"free": False, "pro": True,  "ultra": True},
    "image_gen":         {"free": True,  "pro": True,  "ultra": True},
    "agents":            {"free": False, "pro": True,  "ultra": True},
    "canvas":            {"free": False, "pro": True,  "ultra": True},
    "research":          {"free": False, "pro": True,  "ultra": True},
    "sandbox":           {"free": False, "pro": True,  "ultra": True},
    "tools":             {"free": False, "pro": True,  "ultra": True},
    "rag":               {"free": False, "pro": True,  "ultra": True},
    "code_page":         {"free": True,  "pro": True,  "ultra": True},
    "code_projects":     {"free": False, "pro": True,  "ultra": True},
    "code_export":       {"free": False, "pro": True,  "ultra": True},
    "code_deploy":       {"free": False, "pro": True,  "ultra": True},
    "ultra_model":       {"free": False, "pro": False, "ultra": True},
    "deep_research":     {"free": False, "pro": False, "ultra": True},
}

DAILY_LIMITS: Dict[str, Dict[str, int]] = {
    "chat_messages":  {"free": 25,  "pro": 2000, "ultra": 999999},
    "code_messages":  {"free": 3,   "pro": 500,  "ultra": 999999},
    "image_gen":      {"free": 20,  "pro": 200,  "ultra": 500},
    "web_search":     {"free": 5,   "pro": 500,  "ultra": 5000},
    "vision":         {"free": 0,   "pro": 100,  "ultra": 1000},
    "tts":            {"free": 0,   "pro": 100,  "ultra": 1000},
    "reasoning":      {"free": 0,   "pro": 200,  "ultra": 2000},
    "sandbox_run":    {"free": 0,   "pro": 200,  "ultra": 2000},
    "rag_query":      {"free": 0,   "pro": 500,  "ultra": 5000},
    "deep_research":  {"free": 0,   "pro": 0,    "ultra": 50},
}

_LEGACY_PRO_ALIASES = {"paid", "premium", "pro"}


def user_tier(user: User) -> str:
    """Returns 'free' | 'pro' | 'ultra', normalizing legacy tier strings."""
    raw = (user.tier or "free").lower()
    if raw == "ultra":
        return "ultra"
    if raw in _LEGACY_PRO_ALIASES:
        return "pro"
    return "free"


def has_access(user: User, feature: str) -> bool:
    tier = user_tier(user)
    rule = FEATURE_ACCESS.get(feature)
    if rule is None:
        # Unknown/ungated feature name -- fail open rather than silently
        # locking out something nobody explicitly restricted.
        return True
    return rule.get(tier, False)


def check_daily_limit(db: Session, user: User, feature: str) -> Tuple[bool, int, int]:
    """Returns (allowed, used_today, limit). A feature with no configured
    limit is always allowed (limit reported as 0 -- meaning "unlimited",
    not "zero")."""
    limits = DAILY_LIMITS.get(feature)
    if limits is None:
        return True, 0, 0
    tier = user_tier(user)
    limit = limits.get(tier, 0)
    today = date.today()
    row = db.query(UsageDaily).filter_by(user_id=user.id, feature=feature, date=today).first()
    used = row.count if row else 0
    return used < limit, used, limit


def increment_usage(db: Session, user: User, feature: str) -> None:
    """Atomic at the SQL level (UPDATE ... SET count = count + 1), not a
    Python-side read-modify-write, so concurrent requests can't lose an
    increment. Falls back to inserting the first row of the day, with a
    retry if a concurrent request created it first."""
    today = date.today()
    result = db.execute(
        update(UsageDaily)
        .where(UsageDaily.user_id == user.id, UsageDaily.feature == feature, UsageDaily.date == today)
        .values(count=UsageDaily.count + 1)
    )
    if result.rowcount == 0:
        db.add(UsageDaily(user_id=user.id, feature=feature, date=today, count=1))
        try:
            db.commit()
            return
        except IntegrityError:
            db.rollback()
            db.execute(
                update(UsageDaily)
                .where(UsageDaily.user_id == user.id, UsageDaily.feature == feature, UsageDaily.date == today)
                .values(count=UsageDaily.count + 1)
            )
    db.commit()


def require_feature(feature: str):
    """
    FastAPI dependency (NOT a Python decorator) that gates a route behind
    a tier's feature access and daily limit, incrementing usage on
    success. A plain function decorator wrapping a route handler doesn't
    work correctly here: FastAPI resolves Depends() by inspecting the
    route's own signature, and a decorator that collapses the handler's
    parameters into *args/**kwargs breaks that inspection for every
    other dependency on the route (get_db, request bodies, etc).
    A dependency composes with them exactly like a plain
    Depends(get_current_user) does.

    Usage: user: User = Depends(require_feature("vision"))
    -- replaces Depends(get_current_user) directly; the route still
    receives the checked User the same way.
    """
    def _dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        tier = user_tier(current_user)
        if not has_access(current_user, feature):
            raise HTTPException(status_code=402, detail={
                "error": "upgrade_required",
                "feature": feature,
                "current_tier": tier,
                "suggested_tier": "pro" if tier == "free" else "ultra",
                "upgrade_url": "/pricing",
            })
        allowed, used, limit = check_daily_limit(db, current_user, feature)
        if not allowed:
            raise HTTPException(status_code=429, detail={
                "error": "daily_limit_reached",
                "feature": feature,
                "used": used,
                "limit": limit,
                "resets_at": "midnight UTC",
                "upgrade_url": "/pricing",
            })
        increment_usage(db, current_user, feature)
        return current_user
    return _dependency
