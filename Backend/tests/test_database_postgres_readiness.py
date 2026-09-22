"""app/database.py's _ensure_column() used to be SQLite-only (PRAGMA
table_info, and DDL literals like "DATETIME"/"DEFAULT 0" that PostgreSQL
either doesn't have or is stricter about) -- it would have crashed init_db()
outright on first run against Postgres. These tests exercise the
SQLite path for real (same engine the rest of the suite uses) and the
PostgreSQL path against a fake connection/dialect, since no live Postgres
server is available in this environment -- that part is NOT an end-to-end
verification against real PostgreSQL, only of this function's own SQL and
control flow. See the docstring on _ensure_column for the same caveat.
"""
from unittest.mock import MagicMock

from app.database import _ensure_column, engine


def test_ensure_column_sqlite_adds_a_missing_column_and_is_idempotent(client):
    # `client` (session-scoped) has already run the app's startup, which
    # calls init_db() and creates every table -- needed before ALTER TABLE.
    _ensure_column("otps", "_test_extra_col", "VARCHAR")
    with engine.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(otps)")}
    assert "_test_extra_col" in cols

    # Calling it again must not raise (column already exists).
    _ensure_column("otps", "_test_extra_col", "VARCHAR")


def test_ensure_column_postgres_path_uses_information_schema_and_quotes_identifiers(monkeypatch):
    fake_conn = MagicMock()
    fake_conn.exec_driver_sql.return_value.first.return_value = None  # column doesn't exist yet
    fake_conn.__enter__.return_value = fake_conn
    fake_conn.__exit__.return_value = False

    monkeypatch.setattr(engine.dialect, "name", "postgresql")
    monkeypatch.setattr(engine, "connect", lambda: fake_conn)

    _ensure_column("users", "is_deleted", "BOOLEAN NOT NULL DEFAULT 0", postgres_ddl_type="BOOLEAN NOT NULL DEFAULT FALSE")

    calls = [c.args[0] for c in fake_conn.exec_driver_sql.call_args_list]
    assert any("information_schema.columns" in sql for sql in calls)
    alter = next(sql for sql in calls if sql.strip().upper().startswith("ALTER TABLE"))
    assert '"users"' in alter and '"is_deleted"' in alter
    assert "DEFAULT FALSE" in alter  # the Postgres override, not SQLite's DEFAULT 0
    assert "PRAGMA" not in alter


def test_ensure_column_postgres_path_skips_alter_when_column_already_exists(monkeypatch):
    fake_conn = MagicMock()
    fake_conn.exec_driver_sql.return_value.first.return_value = (1,)  # column already there
    fake_conn.__enter__.return_value = fake_conn
    fake_conn.__exit__.return_value = False

    monkeypatch.setattr(engine.dialect, "name", "postgresql")
    monkeypatch.setattr(engine, "connect", lambda: fake_conn)

    _ensure_column("users", "is_deleted", "BOOLEAN NOT NULL DEFAULT 0")

    calls = [c.args[0] for c in fake_conn.exec_driver_sql.call_args_list]
    assert not any(sql.strip().upper().startswith("ALTER TABLE") for sql in calls)
