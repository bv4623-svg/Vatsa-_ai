"""B11: two workers must never both execute the same scheduled-task fire.
locking.py's SET-NX-style mutual exclusion is tested directly (against
both the in-process and a fake-Redis backend) since spinning up two real
worker processes in a unit test would be slow and flaky; the underlying
guarantee is the same either way -- whichever caller's acquire() call
wins is the only one that proceeds."""
import threading

from app.services.scheduled_tasks import locking


class _FakeRedisClient:
    """Just enough of redis-py's API (SET ... NX EX, DELETE) to exercise
    _RedisLock's logic without a real Redis server."""

    def __init__(self):
        self._store = {}
        self._guard = threading.Lock()

    def set(self, key, value, nx=False, ex=None):
        with self._guard:
            if nx and key in self._store:
                return None
            self._store[key] = value
            return True

    def delete(self, key):
        with self._guard:
            self._store.pop(key, None)


def _race(lock_backend, key: str):
    """Has two threads call acquire() for the same key at (as close to)
    the same time as possible, and returns their results."""
    results = []
    barrier = threading.Barrier(2)

    def worker():
        barrier.wait()
        results.append(lock_backend.acquire(key, ttl_seconds=60))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def test_in_memory_lock_lets_only_one_of_two_racing_threads_acquire():
    backend = locking._InMemoryLock()
    results = _race(backend, "task-in-memory")
    assert sorted(results) == [False, True]


def test_redis_lock_lets_only_one_of_two_racing_callers_acquire():
    backend = locking._RedisLock(_FakeRedisClient())
    results = _race(backend, "task-redis")
    assert sorted(results) == [False, True]


def test_release_allows_a_later_acquire():
    backend = locking._InMemoryLock()
    assert backend.acquire("task-reuse", ttl_seconds=60) is True
    assert backend.acquire("task-reuse", ttl_seconds=60) is False
    backend.release("task-reuse")
    assert backend.acquire("task-reuse", ttl_seconds=60) is True


def test_runner_skips_execution_when_the_lock_is_already_held(monkeypatch):
    """Proves the wiring in runner.py, not just the primitive: with the
    lock already held for a task, run_scheduled_task_sync must return
    without ever calling into AIService or touching the DB."""
    from app.services.scheduled_tasks import runner

    monkeypatch.setattr(runner, "try_acquire_run_lock", lambda task_id: False)

    called = {"ran": False}

    def _should_not_run(*args, **kwargs):
        called["ran"] = True

    monkeypatch.setattr(runner, "_run_task_async", _should_not_run)

    runner.run_scheduled_task_sync("some-task-id")
    assert called["ran"] is False
