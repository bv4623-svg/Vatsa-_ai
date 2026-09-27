"""The scheduler's jobstore is SQLAlchemy-backed using the app's own DB
engine (see app/database.py) -- every worker process shares the same job
definitions via the DB, same intent as the RedisJobStore this replaced
(switched off Redis specifically because Upstash's free tier drops idle
connections). Falls back to APScheduler's own in-memory jobstore if
building the store fails for any reason. See
app/services/scheduled_tasks/manager.py:_build_jobstore()."""
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

from app.database import engine
from app.services.scheduled_tasks.manager import _build_jobstore


def test_jobstore_is_sqlalchemy_backed_on_the_apps_own_engine():
    store = _build_jobstore()
    assert isinstance(store, SQLAlchemyJobStore)
    assert store.engine is engine


def test_jobstore_falls_back_when_sqlalchemy_jobstore_construction_fails(monkeypatch):
    import apscheduler.jobstores.sqlalchemy as sqlalchemy_jobstore_module

    def _raise(*args, **kwargs):
        raise RuntimeError("simulated SQLAlchemyJobStore construction failure")

    monkeypatch.setattr(sqlalchemy_jobstore_module, "SQLAlchemyJobStore", _raise)
    assert isinstance(_build_jobstore(), MemoryJobStore)
