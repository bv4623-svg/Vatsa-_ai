"""Pre-deploy gate: exits non-zero if the backend must not go live.

    cd Backend && python -m scripts.predeploy_check

Checks, in order:
  1. secrets: every required variable is set (in production), none is a
     placeholder or malformed, and none still holds a value that leaked in
     git history (app/core/secrets_check.py; the same check runs at startup);
  2. database: reachable (SELECT 1);
  3. data directory: exists and is writable (SQLite, uploads, images).

Render runs it before uvicorn (render.yaml startCommand). If it fails, the
new instance never passes its health check and Render keeps the previous
deploy live. Prints variable names only, never values.
"""
import os
import sys
import tempfile
from pathlib import Path
from typing import List, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.secrets_check import check_secrets, is_production  # noqa: E402


def database_url() -> str:
    data_dir = Path(os.getenv("DATA_DIR") or BACKEND_DIR)
    url = os.getenv("DATABASE_URL") or f"sqlite:///{data_dir / 'vatsa.db'}"
    return url.replace("sqlite+aiosqlite", "sqlite")


def check_database(url: Optional[str] = None) -> List[str]:
    url = url or database_url()
    try:
        engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return []
    except Exception as exc:  # the message has no credentials: we only print the exception type
        return [f"database is not reachable ({type(exc).__name__}); check DATABASE_URL / DATA_DIR"]


def check_data_dir(path: Optional[str] = None) -> List[str]:
    target = Path(path or os.getenv("DATA_DIR") or BACKEND_DIR)
    if not target.is_dir():
        return [f"DATA_DIR {target} does not exist (is the persistent disk mounted?)"]
    try:
        with tempfile.NamedTemporaryFile(dir=target, prefix=".predeploy-", delete=True):
            pass
    except OSError:
        return [f"DATA_DIR {target} is not writable"]
    return []


def run() -> List[str]:
    return check_secrets() + check_data_dir() + check_database()


def main() -> int:
    mode = "production" if is_production(os.environ) else "non-production"
    problems = run()
    if problems:
        print(f"PRE-DEPLOY CHECK FAILED ({mode}):", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print(f"Pre-deploy check passed ({mode}): secrets OK, database reachable, data directory writable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
