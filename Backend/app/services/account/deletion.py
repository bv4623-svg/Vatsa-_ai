import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User

logger = logging.getLogger("AccountDeletion")

HARD_DELETE_GRACE_DAYS = 30

# Tables whose rows outlive the account (see models/payment.py).
RETAINED_TABLES = {"payments"}


def soft_delete_account(db: Session, user: User) -> None:
    """Blocks login immediately (is_active=False is already checked by
    get_current_user and the login endpoint) without destroying data --
    a real hard delete follows automatically after the grace period via
    hard_delete_expired_accounts."""
    user.is_deleted = True
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()


def _tables_with_user_id(db: Session) -> list:
    """Table/column names come from the database's own schema catalog here,
    never from user input, so the f-strings below (in _cascade_delete_user)
    are safe -- but the catalog queries themselves are SQLite-specific
    (sqlite_master, PRAGMA table_info). information_schema is the portable
    equivalent for PostgreSQL. Not verified against a live PostgreSQL server
    (none was available while writing this) -- the SQLite path is unchanged
    and still covered by the existing test suite.
    """
    dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
    tables = []
    if dialect == "sqlite":
        rows = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
        for (name,) in rows:
            cols = db.execute(text(f"PRAGMA table_info({name})")).fetchall()
            if any(c[1] == "user_id" for c in cols):
                tables.append(name)
    else:
        rows = db.execute(
            text(
                "SELECT DISTINCT table_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND column_name = 'user_id'"
            )
        ).fetchall()
        tables = [name for (name,) in rows]
    return tables


def _cascade_delete_user(db: Session, user_id: int) -> None:
    """Manual cascade across every table with a user_id column -- this
    app's SQLite connection runs without PRAGMA foreign_keys=ON, so
    ORM-declared relationship() cascades only cover the handful of
    tables User.py itself declares a relationship for; every other
    owned table (library_items, scheduled_tasks, chat_projects,
    api_keys, ...) would otherwise be left orphaned."""
    for table in _tables_with_user_id(db):
        if table == "users":
            continue
        if table in RETAINED_TABLES:
            # Financial records are never deleted. They stop pointing at the
            # account; the email snapshot on the row is what remains.
            db.execute(text(f"UPDATE {table} SET user_id = NULL WHERE user_id = :uid"), {"uid": user_id})
            continue
        db.execute(text(f"DELETE FROM {table} WHERE user_id = :uid"), {"uid": user_id})


def hard_delete_expired_accounts() -> int:
    """Cron target (see app.services.account.scheduler_jobs): permanently
    removes any account whose grace period has elapsed. Runs in its own
    DB session since it's called from a background scheduler thread, not
    a request."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=HARD_DELETE_GRACE_DAYS)
    db = SessionLocal()
    deleted = 0
    try:
        expired = db.query(User).filter(User.is_deleted.is_(True), User.deleted_at <= cutoff).all()
        for user in expired:
            _cascade_delete_user(db, user.id)
            db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user.id})
            deleted += 1
        db.commit()
    except Exception:
        logger.exception("Hard-delete pass failed")
        db.rollback()
    finally:
        db.close()
    return deleted
