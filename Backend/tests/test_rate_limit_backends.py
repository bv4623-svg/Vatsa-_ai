"""app/utils/rate_limit.py: the in-memory backend's algorithm, the Redis
backend's INCR/EXPIRE glue (against a small fake standing in for a real
redis-py client -- there is no live Redis server in this environment, so
this checks our logic, not the real network round-trip), and that a
misconfigured REDIS_URL degrades to the in-memory backend instead of
crashing the process.
"""
import pytest
from fastapi import HTTPException

from app.utils.rate_limit import InMemoryRateLimitBackend, RedisRateLimitBackend, _build_backend, enforce_rate_limit


def test_in_memory_allows_up_to_the_limit_then_blocks():
    backend = InMemoryRateLimitBackend()
    for _ in range(3):
        allowed, _ = backend.hit("k", limit=3, window_seconds=60)
        assert allowed is True
    allowed, retry_after = backend.hit("k", limit=3, window_seconds=60)
    assert allowed is False
    assert retry_after > 0


def test_in_memory_window_resets_after_expiry():
    clock = {"t": 1000.0}
    backend = InMemoryRateLimitBackend()
    import app.utils.rate_limit as mod
    orig_time = mod.time.time
    mod.time.time = lambda: clock["t"]
    try:
        for _ in range(2):
            backend.hit("k", limit=2, window_seconds=10)
        allowed, _ = backend.hit("k", limit=2, window_seconds=10)
        assert allowed is False
        clock["t"] += 11
        allowed, _ = backend.hit("k", limit=2, window_seconds=10)
        assert allowed is True
    finally:
        mod.time.time = orig_time


def test_in_memory_reset_clears_the_bucket():
    backend = InMemoryRateLimitBackend()
    backend.hit("k", limit=1, window_seconds=60)
    allowed, _ = backend.hit("k", limit=1, window_seconds=60)
    assert allowed is False
    backend.reset("k")
    allowed, _ = backend.hit("k", limit=1, window_seconds=60)
    assert allowed is True


class _FakeRedisClient:
    """Stands in for redis.Redis: enough of INCR/EXPIRE/TTL/DELETE to
    exercise RedisRateLimitBackend's logic. Not a real Redis connection."""

    def __init__(self):
        self.values = {}
        self.ttls = {}

    def incr(self, key):
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    def expire(self, key, seconds):
        self.ttls[key] = seconds

    def ttl(self, key):
        return self.ttls.get(key, -1)

    def delete(self, key):
        self.values.pop(key, None)
        self.ttls.pop(key, None)


def test_redis_backend_sets_expiry_only_on_first_hit_and_blocks_over_limit():
    client = _FakeRedisClient()
    backend = RedisRateLimitBackend(client)

    allowed, _ = backend.hit("k", limit=2, window_seconds=30)
    assert allowed is True
    assert client.ttls["ratelimit:k"] == 30

    allowed, _ = backend.hit("k", limit=2, window_seconds=30)
    assert allowed is True

    allowed, retry_after = backend.hit("k", limit=2, window_seconds=30)
    assert allowed is False
    assert retry_after == 30  # from the fake's ttl()


def test_redis_backend_reset_deletes_the_key():
    client = _FakeRedisClient()
    backend = RedisRateLimitBackend(client)
    backend.hit("k", limit=1, window_seconds=30)
    backend.reset("k")
    assert "ratelimit:k" not in client.values


def test_build_backend_without_redis_url_uses_in_memory(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    backend = _build_backend()
    assert isinstance(backend, InMemoryRateLimitBackend)


def test_build_backend_falls_back_when_redis_unreachable(monkeypatch):
    # No real Redis in this environment (and the `redis` package isn't
    # installed either) -- either way this must degrade, not crash.
    monkeypatch.setenv("REDIS_URL", "redis://localhost:1/0")
    backend = _build_backend()
    assert isinstance(backend, InMemoryRateLimitBackend)


def test_enforce_rate_limit_raises_429_with_retry_after_header():
    import app.utils.rate_limit as mod
    original = mod._backend
    mod._backend = InMemoryRateLimitBackend()
    try:
        enforce_rate_limit("t", limit=1, window_seconds=60)
        with pytest.raises(HTTPException) as exc_info:
            enforce_rate_limit("t", limit=1, window_seconds=60)
        assert exc_info.value.status_code == 429
        assert "Retry-After" in exc_info.value.headers
    finally:
        mod._backend = original
