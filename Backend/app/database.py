import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os
from typing import Generator, Optional

logger = logging.getLogger("Database")

BACKEND_DIR = Path(__file__).resolve().parent.parent
# DATA_DIR moves everything this app writes (database, uploads, generated
# images) onto one directory, so a single persistent disk can hold it all.
DATA_DIR = Path(os.getenv("DATA_DIR") or BACKEND_DIR)
DEFAULT_DB_PATH = DATA_DIR / "vatsa.db"
raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

if "sqlite+aiosqlite" in raw_db_url:
    SQLALCHEMY_DATABASE_URL = raw_db_url.replace("sqlite+aiosqlite", "sqlite")
else:
    SQLALCHEMY_DATABASE_URL = raw_db_url

_IS_SQLITE = "sqlite" in SQLALCHEMY_DATABASE_URL

if _IS_SQLITE:
    # SQLite is a single file; SQLAlchemy's own pooling knobs don't apply
    # the way they do for a real server, and check_same_thread=False is
    # what lets one connection be reused across FastAPI's threadpool.
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL (or another real DB server) behind more than one API
    # instance/worker: pool_pre_ping avoids handing out a connection the
    # server (or a managed provider's idle-connection reaper) already
    # closed, and pool_size/max_overflow/pool_recycle are configurable per
    # deployment rather than hardcoded. Defaults are conservative for a
    # single small instance; raise DB_POOL_SIZE alongside API instance count.
    _pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
    _max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    _pool_recycle = int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800"))
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_size=_pool_size,
        max_overflow=_max_overflow,
        pool_recycle=_pool_recycle,
    )
    logger.info("DB pool: size=%d overflow=%d recycle=%ds", _pool_size, _max_overflow, _pool_recycle)

# expire_on_commit=False: without it, every attribute access on an ORM
# object AFTER any db.commit() in the same request re-issues a SELECT to
# refresh it (SQLAlchemy's default), even though nothing else changed the
# row -- measured live: a single /api/chat call issued ~20 real queries,
# several of them re-fetching the same User/Conversation row after an
# unrelated commit elsewhere in the same request (e.g. TokenService
# deducting tokens commits, then the handler goes on to read user.tier).
# The ~30 explicit db.refresh() calls already in this codebase are exactly
# the places that DO need a fresh value right after a commit (e.g. a
# server-generated id/timestamp); this only removes the *implicit*,
# blanket refresh everywhere else.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
Base = declarative_base()

def get_db() -> Generator:
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _ensure_column(table: str, column: str, ddl_type: str, *, postgres_ddl_type: Optional[str] = None) -> None:
    """Best-effort ALTER TABLE ADD COLUMN, for SQLite or PostgreSQL.

    This project has no migration framework -- Base.metadata.create_all()
    only creates TABLES that don't exist yet; it never adds a new column
    to a table that's already there. A brand-new model/table needs
    nothing here (create_all() builds it with every column already), but
    adding a column to an existing table (e.g. Conversation.project_id
    for the Projects feature) does, so it's handled defensively here on
    every startup rather than requiring a one-off manual migration.

    `ddl_type` is used for both dialects unless `postgres_ddl_type` is given
    -- needed wherever the two disagree, e.g. SQLite's untyped/permissive
    "BOOLEAN ... DEFAULT 0" (SQLite has no real boolean type) isn't valid
    Postgres, which wants DEFAULT FALSE, and SQLite's DATETIME isn't a
    Postgres type at all (TIMESTAMP is). PRAGMA table_info is SQLite-only
    too, hence the dialect branch below.

    Postgres note: this has NOT been run against a live PostgreSQL server
    (none was available while writing it) -- it's written to be correct
    per Postgres's documented DDL syntax, but treat it as unverified until
    it's actually exercised against one. SQLite behavior is unchanged and
    is covered by the existing test suite (tests/test_urls.py etc. boot the
    real app, which calls init_db()).
    """
    dialect = engine.dialect.name
    with engine.connect() as conn:
        if dialect == "sqlite":
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if column not in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
                conn.commit()
        else:
            # Standard SQL (PostgreSQL and friends): information_schema is portable.
            row = conn.exec_driver_sql(
                "SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s",
                (table, column),
            ).first()
            if row is None:
                conn.exec_driver_sql(
                    f'ALTER TABLE "{table}" ADD COLUMN "{column}" {postgres_ddl_type or ddl_type}'
                )
                conn.commit()

def init_db():
    """Ensure all models are registered and create missing tables.

    Every model module must be imported here (even ones no live router
    queries directly) so SQLAlchemy's declarative registry can resolve
    every string-based relationship() the first time any query runs —
    otherwise mapper configuration fails for *all* queries, not just
    ones touching the model that was missing.
    """
    import app.models.user
    import app.models.conversation
    import app.models.memory
    import app.models.subscription
    import app.models.payment
    import app.models.token
    import app.models.project
    import app.models.file
    import app.models.usage
    import app.models.otp
    import app.models.chat
    import app.models.build_log
    import app.models.snapshot
    import app.models.generated_image
    import app.models.usage_daily
    import app.models.library_item
    import app.models.scheduled_task
    import app.models.chat_project
    import app.models.api_key
    import app.models.connected_account
    import app.models.notification
    Base.metadata.create_all(bind=engine)
    _ensure_column("conversations", "project_id", "VARCHAR(36)")
    _ensure_column("library_items", "project_id", "VARCHAR(36)")
    _ensure_column("users", "token_version", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column("users", "is_deleted", "BOOLEAN NOT NULL DEFAULT 0", postgres_ddl_type="BOOLEAN NOT NULL DEFAULT FALSE")
    _ensure_column("users", "deleted_at", "DATETIME", postgres_ddl_type="TIMESTAMP")
    _ensure_column("users", "totp_secret", "VARCHAR")
    _ensure_column("users", "two_factor_enabled", "BOOLEAN NOT NULL DEFAULT 0", postgres_ddl_type="BOOLEAN NOT NULL DEFAULT FALSE")
    _ensure_column("users", "backup_codes", "JSON")

