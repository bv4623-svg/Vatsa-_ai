from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys, os

_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.append(_BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

from app.database import Base
# Every model module, matching app/database.py's init_db() exactly -- Alembic's
# target_metadata (used for autogenerate and offline mode) must see every
# table the app actually has, not just the five originally listed here.
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

config = context.config

# DATABASE_URL from the environment (.env, or the real environment in
# production) always wins over alembic.ini's own sqlalchemy.url -- that ini
# value is a local-SQLite fallback for when nothing else is configured, not
# the source of truth. Without this, `alembic upgrade head` silently target
# a SQLite file regardless of what the application itself is configured to use.
_database_url = os.getenv("DATABASE_URL")
if _database_url:
    config.set_main_option("sqlalchemy.url", _database_url)

fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
