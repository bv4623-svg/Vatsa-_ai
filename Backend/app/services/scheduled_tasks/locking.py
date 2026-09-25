"""Distributed run-lock so two worker processes sharing the same
scheduled-task set (via a Redis jobstore, see manager.py) never both
execute the same job's fire at the same time. Same pluggable-backend shape
as app/utils/rate_limit.py and app/utils/cache.py:

  - _InMemoryLock (default): a real threading.Lock per key, in this
    worker's own memory. Correctly serializes two THREADS in one process;
    provides no guarantee across two separate worker PROCESSES -- but with
    REDIS_URL unset there's no shared jobstore across processes either, so
    each process's own copy of a job just runs on its own, same as before
    this feature existed.

  - _RedisLock: SET key NX EX ttl_seconds -- the standard Redis mutual-
    exclusion pattern. Whichever worker's SET succeeds owns the lock;
    every other worker's SET (same key, NX) fails and skips this run.
    Selected automatically when REDIS_URL is set and reachable; any
    problem falls back to the in-memory lock, same as the other two
    modules.
"""
import logging
import threading
from typing import Dict, Protocol

logger = logging.getLogger("SchedulerLock")

# Long enough to cover a real task run (an AI generation call plus a DB
# commit and an email send), short enough that a worker that crashed
# mid-run doesn't block every future run of the same task for long.
RUN_LOCK_TTL_SECONDS = 300


class LockBackend(Protocol):
    def acquire(self, key: str, ttl_seconds: int) -> bool: ...
    def release(self, key: str) -> None: ...


class _InMemoryLock:
    def __init__(self) -> None:
        self._locks: Dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def acquire(self, key: str, ttl_seconds: int) -> bool:
        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())
        return lock.acquire(blocking=False)

    def release(self, key: str) -> None:
        with self._guard:
            lock = self._locks.get(key)
        if lock is not None and lock.locked():
            lock.release()


class _RedisLock:
    def __init__(self, client) -> None:
        self._client = client

    def acquire(self, key: str, ttl_seconds: int) -> bool:
        return bool(self._client.set(f"scheduler-lock:{key}", "1", nx=True, ex=ttl_seconds))

    def release(self, key: str) -> None:
        self._client.delete(f"scheduler-lock:{key}")


def _build_backend() -> LockBackend:
    from app.utils.redis_client import get_redis_client

    client = get_redis_client()
    if client is None:
        logger.info(
            "scheduler lock backend: in-process (REDIS_URL not set or Redis "
            "unreachable). This is NOT safe with more than one worker process."
        )
        return _InMemoryLock()
    logger.info("scheduler lock backend: redis")
    return _RedisLock(client)


_backend: LockBackend = _build_backend()
_local_fallback = _InMemoryLock()


def try_acquire_run_lock(task_id: str) -> bool:
    """True if this worker may run `task_id` now. False means another
    worker already holds the lock -- the caller should skip this run
    entirely, not retry (the job's own next scheduled fire will try again)."""
    try:
        return _backend.acquire(task_id, RUN_LOCK_TTL_SECONDS)
    except Exception:
        logger.exception("scheduler lock backend unavailable on acquire(); falling back to in-process for this call")
        return _local_fallback.acquire(task_id, RUN_LOCK_TTL_SECONDS)


def release_run_lock(task_id: str) -> None:
    """Best-effort: releases early so the same task can run again well
    before RUN_LOCK_TTL_SECONDS would have expired it anyway."""
    for backend in (_backend, _local_fallback):
        try:
            backend.release(task_id)
        except Exception:
            logger.exception("scheduler lock backend unavailable on release()")
