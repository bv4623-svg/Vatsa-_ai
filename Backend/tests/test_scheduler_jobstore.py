"""B11: the scheduler's jobstore is Redis-backed only when REDIS_URL is set
and reachable, and falls back to APScheduler's own in-memory jobstore for
everything else (unset, unreachable, package missing). See
app/services/scheduled_tasks/manager.py:_build_jobstore()."""
from apscheduler.jobstores.memory import MemoryJobStore

from app.services.scheduled_tasks.manager import _build_jobstore


def test_jobstore_is_in_memory_when_redis_url_is_unset(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "")
    assert isinstance(_build_jobstore(), MemoryJobStore)


def test_jobstore_falls_back_when_redis_is_unreachable(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:1/0")  # nothing listens on port 1
    assert isinstance(_build_jobstore(), MemoryJobStore)
