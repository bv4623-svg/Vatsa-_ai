from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os
from typing import Generator

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "vatsa.db"
raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

if "sqlite+aiosqlite" in raw_db_url:
    SQLALCHEMY_DATABASE_URL = raw_db_url.replace("sqlite+aiosqlite", "sqlite")
else:
    SQLALCHEMY_DATABASE_URL = raw_db_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator:
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _ensure_column(table: str, column: str, ddl_type: str) -> None:
    """Best-effort ALTER TABLE ADD COLUMN for SQLite.

    This project has no migration framework -- Base.metadata.create_all()
    only creates TABLES that don't exist yet; it never adds a new column
    to a table that's already there. A brand-new model/table needs
    nothing here (create_all() builds it with every column already), but
    adding a column to an existing table (e.g. Conversation.project_id
    for the Projects feature) does, so it's handled defensively here on
    every startup rather than requiring a one-off manual migration.
    """
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
        if column not in existing:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
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
    Base.metadata.create_all(bind=engine)
    _ensure_column("conversations", "project_id", "VARCHAR(36)")
    _ensure_column("library_items", "project_id", "VARCHAR(36)")

