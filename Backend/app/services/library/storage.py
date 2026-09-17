"""Real storage accounting: every number here comes from SUM(size_bytes)
over library_items, never a cached or estimated figure."""
from typing import Any, Dict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.library_item import LibraryItem
from app.models.user import User
from app.services.storage_limits import storage_limit_bytes

WARNING_THRESHOLD = 0.9

ITEM_TYPES = ("chat", "document", "code", "artifact", "upload", "generated")


def get_storage_usage(db: Session, user: User) -> Dict[str, Any]:
    """SELECT COALESCE(SUM(size_bytes),0) FROM library_items WHERE
    user_id = :user_id AND is_folder = false -- folders own no bytes of
    their own, only the real files/chats placed inside them."""
    used_bytes = (
        db.query(func.coalesce(func.sum(LibraryItem.size_bytes), 0))
        .filter(LibraryItem.user_id == user.id, LibraryItem.is_folder.is_(False))
        .scalar()
    ) or 0

    limit_bytes = storage_limit_bytes(user)
    percent = (used_bytes / limit_bytes) if limit_bytes > 0 else 0.0

    return {
        "used_bytes": int(used_bytes),
        "limit_bytes": int(limit_bytes),
        "used_gb": round(used_bytes / (1024 ** 3), 3),
        "limit_gb": round(limit_bytes / (1024 ** 3), 3),
        "percent": round(min(percent, 1.0) * 100, 2),
        "at_warning": percent >= WARNING_THRESHOLD,
        "at_limit": used_bytes >= limit_bytes,
        "breakdown": get_storage_breakdown(db, user),
    }


def get_storage_breakdown(db: Session, user: User) -> Dict[str, int]:
    """Real GROUP BY, not a hardcoded per-type split."""
    rows = (
        db.query(LibraryItem.type, func.coalesce(func.sum(LibraryItem.size_bytes), 0))
        .filter(LibraryItem.user_id == user.id, LibraryItem.is_folder.is_(False))
        .group_by(LibraryItem.type)
        .all()
    )
    breakdown = {t: 0 for t in ITEM_TYPES}
    for item_type, total in rows:
        breakdown[item_type] = int(total)
    return breakdown


def check_quota(db: Session, user: User, additional_bytes: int) -> tuple[bool, Dict[str, Any]]:
    """Returns (allowed, usage). Called before writing new bytes (uploads,
    generated images) so a user at 100% is blocked before the write, not
    after."""
    usage = get_storage_usage(db, user)
    allowed = (usage["used_bytes"] + additional_bytes) <= usage["limit_bytes"]
    return allowed, usage
