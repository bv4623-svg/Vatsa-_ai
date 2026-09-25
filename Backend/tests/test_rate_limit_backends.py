"""app/utils/rate_limit.py: the in-memory backend's algorithm, the Redis
backend's INCR/EXPIRE glue (against a small fake standing in for a real
redis-py client -- there is no live Redis server in this environment, so
this checks our logic, not the real network round-trip), and that a
misconfigured REDIS_URL degrades to the in-memory backend instead of
crashing the process.
"""
import pytest
from fastapi import HTTPException

from app.utils.rate_limit import (
    InMemoryRateLimitBackend, RedisRateLimitBackend, _build_backend, enforce_rate_limit, reset_rate_limit,
)


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


class _DeadRedisClient:
    """Stands in for a redis-py client whose connection has dropped: every
    command raises, matching what redis.exceptions.ConnectionError/TimeoutError
    look like from the caller's side."""

    def incr(self, key):
        raise ConnectionError("Redis connection dropped (simulated)")

    def expire(self, key, seconds):
        raise ConnectionError("Redis connection dropped (simulated)")

    def ttl(self, key):
        raise ConnectionError("Redis connection dropped (simulated)")

    def delete(self, key):
        raise ConnectionError("Redis connection dropped (simulated)")


def test_enforce_rate_limit_degrades_instead_of_crashing_when_redis_dies_mid_process():
    """Regression test: found live against the real vatsa-redis container --
    _build_backend() only handles Redis being unreachable at startup. Once
    _backend is a RedisRateLimitBackend, a LATER connection failure (Redis
    restarts, network blip, container stopped) used to propagate straight out
    of enforce_rate_limit() as an unhandled exception -- every rate-limited
    endpoint (login, OTP send, 2FA, admin-payments) would 500 instead of
    falling back. See app/utils/rate_limit.py's _local_fallback."""
    import app.utils.rate_limit as mod
    original_backend = mod._backend
    original_fallback = mod._local_fallback
    mod._backend = RedisRateLimitBackend(_DeadRedisClient())
    mod._local_fallback = InMemoryRateLimitBackend()
    try:
        enforce_rate_limit("dead-redis-key", limit=1, window_seconds=60)  # must not raise
        with pytest.raises(HTTPException) as exc_info:
            enforce_rate_limit("dead-redis-key", limit=1, window_seconds=60)
        assert exc_info.value.status_code == 429  # the in-process fallback enforced it
    finally:
        mod._backend = original_backend
        mod._local_fallback = original_fallback


def test_reset_rate_limit_does_not_raise_when_redis_is_dead():
    import app.utils.rate_limit as mod
    original_backend = mod._backend
    mod._backend = RedisRateLimitBackend(_DeadRedisClient())
    try:
        reset_rate_limit("dead-redis-key")  # must not raise
    finally:
        mod._backend = original_backend


# -- Optional live-Redis tests: run only when a real Redis is reachable at
# the URL below, so this suite stays deterministic in environments without
# one (e.g. plain `pytest` with no REDIS_URL configured). This project's dev
# setup runs one in Docker as `vatsa-redis`. --------------------------------
def _live_redis_client():
    try:
        import redis
    except ImportError:
        return None
    try:
        client = redis.Redis.from_url("redis://localhost:6379/0", socket_timeout=1, socket_connect_timeout=1)
        client.ping()
        return client
    except Exception:
        return None


@pytest.mark.skipif(_live_redis_client() is None, reason="no live Redis reachable at redis://localhost:6379/0")
def test_redis_backend_against_a_real_live_redis_server():
    client = _live_redis_client()
    backend = RedisRateLimitBackend(client)
    key = "pytest-live-redis-check"
    client.delete(f"ratelimit:{key}")
    try:
        allowed, _ = backend.hit(key, limit=2, window_seconds=5)
        assert allowed is True
        allowed, _ = backend.hit(key, limit=2, window_seconds=5)
        assert allowed is True
        allowed, retry_after = backend.hit(key, limit=2, window_seconds=5)
        assert allowed is False
        assert 0 < retry_after <= 5
        ttl = client.ttl(f"ratelimit:{key}")
        assert 0 < ttl <= 5  # a real TTL, set by a real EXPIRE, read back from a real server
        backend.reset(key)
        assert client.exists(f"ratelimit:{key}") == 0
    finally:
        client.delete(f"ratelimit:{key}")
