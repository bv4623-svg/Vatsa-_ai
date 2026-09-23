from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.library import check_quota
from app.services.account import notify_quota_warning
from app.services.feature_access import check_daily_limit, increment_usage


def _enforce_daily_limit(db: Session, user: User, feature: str) -> None:
    """
    Raises 429 (with the shape the frontend's upgrade UI expects) once a
    user's free/pro/business daily cap for `feature` is hit, else records
    this call against today's count. Chat and Code share one endpoint
    (distinguished only by req.workspace in the body), so this can't be
    a route-level dependency the way vision's require_feature() is --
    it has to run after the request body is parsed.
    """
    allowed, used, limit = check_daily_limit(db, user, feature)
    if not allowed:
        raise HTTPException(status_code=429, detail={
            "error": "daily_limit_reached",
            "feature": feature,
            "used": used,
            "limit": limit,
            "resets_at": "midnight UTC",
            "upgrade_url": "/pricing",
        })
    increment_usage(db, user, feature)


def _enforce_storage_quota(db: Session, user: User, estimated_bytes: int) -> None:
    """Raises 413 before generating an image that would push the user over
    their plan's storage ceiling. Checked here rather than inside
    generate_and_store_image() because that function's caller wraps every
    exception in a generic 502 -- this must run, and raise, before that
    try block."""
    allowed, usage = check_quota(db, user, estimated_bytes)
    if not allowed:
        notify_quota_warning(db, user, usage["used_bytes"], usage["limit_bytes"], at_limit=True)
        raise HTTPException(status_code=413, detail={
            "error": "storage_limit_reached",
            "used_bytes": usage["used_bytes"],
            "limit_bytes": usage["limit_bytes"],
            "upgrade_url": "/pricing",
        })
    elif usage["at_warning"]:
        notify_quota_warning(db, user, usage["used_bytes"], usage["limit_bytes"], at_limit=False)
