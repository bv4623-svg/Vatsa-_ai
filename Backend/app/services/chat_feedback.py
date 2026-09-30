"""👍/👎 on assistant replies (Phase 0 Fix 3): saving votes, forgetting them
with their conversation, and the numbers for the admin page."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.chat_feedback import REASONS, ChatFeedback


def _today() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def save_vote(db: Session, user_id: int, conversation_id: str, message_id: str, rating: str, reason: Optional[str]) -> ChatFeedback:
    """Insert or update the one vote a user has on a reply. A reason is kept
    only with a thumbs-down."""
    reason = reason if rating == "down" else None
    key = {"user_id": user_id, "conversation_id": conversation_id, "message_id": message_id}
    row = db.query(ChatFeedback).filter_by(**key).first()
    if row is None:
        row = ChatFeedback(**key, rating=rating, reason=reason)
        db.add(row)
        try:
            db.commit()
            return row
        except IntegrityError:
            # Two clicks raced to insert the same vote; update the one that won.
            db.rollback()
            row = db.query(ChatFeedback).filter_by(**key).one()
    row.rating, row.reason = rating, reason
    db.commit()
    return row


def clear_vote(db: Session, user_id: int, conversation_id: str, message_id: str) -> None:
    db.query(ChatFeedback).filter_by(user_id=user_id, conversation_id=conversation_id, message_id=message_id).delete()
    db.commit()


def forget_votes(db: Session, user_id: int, conversation_ids: Iterable[str]) -> None:
    """Votes go with their conversation. Postgres also cascades the foreign
    key; this makes it hold on every database (SQLite doesn't enforce FKs)."""
    ids = list(conversation_ids)
    if ids:
        db.query(ChatFeedback).filter(ChatFeedback.user_id == user_id, ChatFeedback.conversation_id.in_(ids)).delete(synchronize_session=False)
        db.commit()


def stats(db: Session, days: int) -> dict:
    """Votes cast in the last `days` days (by the day first cast, counted
    at their current rating)."""
    first_day = (_today() - timedelta(days=days - 1)).date()
    rows = (
        db.query(ChatFeedback.rating, ChatFeedback.reason, ChatFeedback.created_at)
        .filter(ChatFeedback.created_at >= datetime.combine(first_day, datetime.min.time()))
        .all()
    )
    per_day = defaultdict(lambda: {"up": 0, "down": 0})
    reasons = {code: 0 for code in REASONS}
    up = down = no_reason = 0
    for rating, reason, created in rows:
        per_day[created.date()][rating] += 1
        if rating == "up":
            up += 1
        else:
            down += 1
            if reason in reasons:
                reasons[reason] += 1
            else:
                no_reason += 1
    total = up + down
    return {
        "days": days,
        "total": total,
        "up": up,
        "down": down,
        "satisfaction": round(up / total, 3) if total else None,
        "by_day": [
            {"date": (first_day + timedelta(days=i)).isoformat(), **per_day[first_day + timedelta(days=i)]}
            for i in range(days)
        ],
        "top_reasons": [{"reason": code, "count": n} for code, n in sorted(reasons.items(), key=lambda kv: -kv[1]) if n],
        "down_without_reason": no_reason,
    }
