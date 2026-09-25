#!/bin/sh
set -e

# This app's schema has historically been created via SQLAlchemy's
# Base.metadata.create_all() (app.database.init_db, also called from the
# app's own lifespan on every boot), not by replaying Alembic migrations
# from an empty database -- none of the existing migrations under
# alembic/versions/ actually create the "users" table, so a literal
# `alembic upgrade head` against a brand-new database fails immediately.
# init_db() is idempotent (safe to run every start: creates only what's
# missing, never touches existing data), so it always runs first to
# guarantee the schema fully matches the current models. If Alembic has
# no history yet on this database, that means init_db() just built the
# whole current schema in one shot, equivalent to every migration having
# already run -- stamp "head" as the baseline instead of replaying
# migrations that assume tables already exist. From then on `alembic
# upgrade head` behaves normally for any migration added after this.
echo "Ensuring database schema is up to date..."
python -c "from app.database import init_db; init_db()"

echo "Checking Alembic migration history..."
if python -c "
from sqlalchemy import inspect
from app.database import engine
raise SystemExit(0 if 'alembic_version' in inspect(engine).get_table_names() else 1)
"; then
  echo "Alembic history already established."
else
  echo "No Alembic history yet -- stamping current schema as baseline."
  alembic stamp head
fi

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting uvicorn..."
# A single worker: on Render's 512MB free tier, each additional worker is a
# full separate process with its own copy of every loaded library -- 4
# workers multiplied the app's baseline memory footprint by 4x for no
# throughput benefit on an instance this small.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --timeout-graceful-shutdown 30
