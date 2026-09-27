"""
Central free/pro/business feature-access and daily-limit definitions.
Every gated endpoint should go through require_feature() (a FastAPI
dependency, not a decorator -- see note below) rather than checking
user.tier directly, so limits/access stay in one place.

Note on tier values: older payment/registration code wrote "pro", "paid",
or "premium" for a paid account; user_tier() normalizes all three to "pro"
so data written before this file existed keeps working without a
migration. "business" is its own real value (see payment_service.py's
_PLAN_META) and must never fold into "pro": frontend/src/data/plans.matrix.ts
promises Business real extras (Deep research, Team collaboration, SSO, 10x
the storage) that Pro doesn't get.
"""
from datetime import date
from typing import Dict, Optional, Tuple
from fastapi import Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.usage_daily import UsageDaily
from app.auth.dependencies import get_current_user

FEATURE_ACCESS: Dict[str, Dict[str, bool]] = {
    "chat_basic":        {"free": True,  "pro": True,  "business": True},
    "chat_streaming":    {"free": True,  "pro": True,  "business": True},
    "web_search":        {"free": True,  "pro": True,  "business": True},
    "memory":            {"free": True,  "pro": True,  "business": True},
    "history":           {"free": True,  "pro": True,  "business": True},
    "vision":            {"free": False, "pro": True,  "business": True},
    "tts":               {"free": False, "pro": True,  "business": True},
    "reasoning":         {"free": False, "pro": True,  "business": True},
    "image_gen":         {"free": True,  "pro": True,  "business": True},
    "agents":            {"free": False, "pro": True,  "business": True},
    "canvas":            {"free": False, "pro": True,  "business": True},
    "research":          {"free": False, "pro": True,  "business": True},
    "sandbox":           {"free": False, "pro": True,  "business": True},
    "tools":             {"free": False, "pro": True,  "business": True},
    "rag":               {"free": False, "pro": True,  "business": True},
    "code_page":         {"free": True,  "pro": True,  "business": True},
    # Every tier can create projects now (count-gated by PROJECT_LIMITS
    # below, not an all-or-nothing switch) -- Free previously read False
    # here but nothing ever actually enforced it (grepped: no caller of
    # has_access()/require_feature() ever checked "code_projects"), so
    # this wasn't a real restriction being loosened, just a stale value
    # made honest.
    "code_projects":     {"free": True,  "pro": True,  "business": True},
    "code_export":       {"free": False, "pro": True,  "business": True},
    "code_deploy":       {"free": False, "pro": True,  "business": True},
    "deep_research":     {"free": False, "pro": False, "business": True},
    "team_collaboration":{"free": False, "pro": False, "business": True},
    "sso":               {"free": False, "pro": False, "business": True},
}

# A tier mapped to None means unlimited for that tier specifically (see
# check_daily_limit below); a feature missing from this dict entirely is
# unlimited for every tier (pre-existing convention). chat_messages and
# code_messages were removed outright -- unlimited on Free/Pro/Business.
DAILY_LIMITS: Dict[str, Dict[str, Optional[int]]] = {
    "image_gen":      {"free": 5,   "pro": 100,  "business": 500},
    "web_search":     {"free": 5,   "pro": None, "business": None},
    "vision":         {"free": 0,   "pro": 100,  "business": 100},
    "tts":            {"free": 0,   "pro": 100,  "business": 100},
    "reasoning":      {"free": 0,   "pro": 200,  "business": 200},
    "sandbox_run":    {"free": 0,   "pro": 200,  "business": 200},
    "rag_query":      {"free": 0,   "pro": 500,  "business": 500},
    # Business has real deep-research access (FEATURE_ACCESS above), unlike
    # Pro. 20/day is a working allowance, not a published figure.
    "deep_research":  {"free": 0,   "pro": 0,    "business": 20},
}

# Total *standing* project count, not a daily counter -- checked against
# how many ChatProject rows the user already has (see check_project_limit),
# never reset. "5x Pro" on Business is a real, deliberate ratio: 200 = 10x
# Pro here, chosen to be generous rather than mechanically 5x every axis.
PROJECT_LIMITS: Dict[str, int] = {"free": 1, "pro": 20, "business": 200}

_LEGACY_PRO_ALIASES = {"paid", "premium", "pro"}


def user_tier(user: User) -> str:
    """Returns 'free' | 'pro' | 'business', normalizing legacy tier
    strings."""
    raw = (user.tier or "free").lower()
    # "ultra" was a third paid plan that no longer exists; anyone still
    # carrying that value keeps the highest tier we do sell.
    if raw in ("business", "ultra"):
        return "business"
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
    """Returns (allowed, used_today, limit). A feature missing from
    DAILY_LIMITS entirely is always allowed for every tier (limit reported
    as 0, meaning "unlimited", not "zero"); a feature present but mapped to
    None for this specific tier is unlimited for that tier only (see
    web_search: free is capped, pro/business are not)."""
    limits = DAILY_LIMITS.get(feature)
    if limits is None:
        return True, 0, 0
    tier = user_tier(user)
    limit = limits.get(tier, 0)
    if limit is None:
        return True, 0, 0
    today = date.today()
    row = db.query(UsageDaily).filter_by(user_id=user.id, feature=feature, date=today).first()
    used = row.count if row else 0
    return used < limit, used, limit


def check_project_limit(db: Session, user: User) -> Tuple[bool, int, int]:
    """Returns (allowed, current_count, limit) for creating one more
    project. Unlike check_daily_limit this counts real, standing rows
    (ChatProject), not a per-day counter that resets at midnight --
    deleting/archiving a project frees up a slot, a new day does not.

    ChatProject backs a separate, ChatGPT-style "folder for organizing
    chats" feature (POST /api/projects) -- not the same resource as a
    "code app" (see check_code_app_limit below), even though they share
    the same 1/20/200 numbers today."""
    from app.models.chat_project import ChatProject

    tier = user_tier(user)
    limit = PROJECT_LIMITS.get(tier, 0)
    used = db.query(ChatProject).filter_by(user_id=user.id).count()
    return used < limit, used, limit


def check_code_app_limit(db: Session, user: User) -> Tuple[bool, int, int]:
    """Returns (allowed, current_count, limit) for creating one more code
    app. A "code app" is a Conversation row with workspace="code" (what
    the /code workspace's "New Project" button actually creates via
    POST /api/conversations) -- a different table from ChatProject above,
    despite the pricing page calling both "projects" at different times.
    Counts every standing row regardless of `archived` (archiving hides a
    conversation from view, it doesn't free a slot -- only a real delete,
    via DELETE /api/conversations/{id}, does)."""
    from app.models.conversation import Conversation

    tier = user_tier(user)
    limit = PROJECT_LIMITS.get(tier, 0)
    used = db.query(Conversation).filter_by(user_id=user.id, workspace="code").count()
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
                "suggested_tier": {"free": "pro", "pro": "business"}.get(tier),
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
