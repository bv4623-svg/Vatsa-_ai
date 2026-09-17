import logging
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.user import User
from app.models.conversation import Conversation
from app.services.library import delete_conversation_item

logger = logging.getLogger("HistoryRetention")

RETENTION_DAYS = {"30d": 30, "90d": 90, "forever": None}


def enforce_history_retention() -> int:
    """Cron target: for every user who has chosen a non-"forever"
    historyRetention setting, deletes conversations last updated before
    the cutoff -- a real daily job, not just a stored-but-unused
    preference. Reuses delete_conversation_item so the paired Library
    item is removed too, the same as a user manually deleting a chat.
    """
    db = SessionLocal()
    deleted = 0
    try:
        for user in db.query(User).filter(User.is_deleted.is_(False)).all():
            retention = (user.settings or {}).get("historyRetention", "forever")
            days = RETENTION_DAYS.get(retention)
            if not days:
                continue
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            stale = db.query(Conversation).filter(Conversation.user_id == user.id, Conversation.updated_at < cutoff).all()
            for conv in stale:
                conv_id = conv.id
                db.delete(conv)
                db.commit()
                try:
                    delete_conversation_item(db, user.id, conv_id)
                except Exception:
                    logger.exception("Library sync failed while enforcing retention for conversation %s", conv_id)
                deleted += 1
    except Exception:
        logger.exception("History retention pass failed")
        db.rollback()
    finally:
        db.close()
    return deleted
