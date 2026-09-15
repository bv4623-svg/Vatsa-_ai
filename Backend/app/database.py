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

def init_db():
    """Ensure all models are registered and create missing tables."""
    import app.models.user
    import app.models.conversation
    import app.models.memory
    import app.models.subscription
    import app.models.token
    import app.models.project
    import app.models.file
    import app.models.usage
    Base.metadata.create_all(bind=engine)

