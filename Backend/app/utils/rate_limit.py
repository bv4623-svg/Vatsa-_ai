"""Rate limiter for auth endpoints (and a couple of admin ones), with a
pluggable backend so the exact same call sites work with either storage:

  - InMemoryRateLimitBackend (default): fixed-window counters in this
    worker's own memory. Enough to blunt credential stuffing against a
    single instance, but with several instances the effective limit is
    (limit x instance count), and a restart clears every counter.

  - RedisRateLimitBackend: the same fixed-window algorithm, but the
    counter lives in Redis, so every API instance enforces the same limit.
    Selected automatically when REDIS_URL is set and reachable; any
    problem (no REDIS_URL, unreachable Redis, `redis` package not
    installed) falls back to the in-memory backend with a logged warning
    rather than crashing the process -- see _build_backend below.

Set REDIS_URL (and add `redis` to requirements.txt, already listed) before
running more than one API instance in production; otherwise each instance
enforces its own separate limit.
"""

import logging
import os
import threading
import time
from typing import Dict, Protocol, Tuple

from fastapi import HTTPException, Request

logger = logging.getLogger("RateLimit")


class RateLimitBackend(Protocol):
    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """Records one hit against `key`. Returns (allowed, retry_after_seconds)."""
        ...

    def reset(self, key: str) -> None:
        ...


class InMemoryRateLimitBackend:
    def __init__(self) -> None:
        self._buckets: Dict[str, Tuple[float, int]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        with self._lock:
            window_start, count = self._buckets.get(key, (now, 0))
            if now - window_start >= window_seconds:
                window_start, count = now, 0
            count += 1
            self._buckets[key] = (window_start, count)
            if count > limit:
                retry_after = int(window_seconds - (now - window_start)) + 1
                return False, retry_after
            return True, 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._buckets.pop(key, None)


class RedisRateLimitBackend:
    """INCR + EXPIRE fixed window -- same semantics as InMemoryRateLimitBackend,
    shared across every process talking to the same Redis. `client` is a
    plain synchronous redis-py client (these call sites are all sync `def`
    endpoints, which FastAPI already runs off the event loop in a thread
    pool, so a blocking network call here is safe)."""

    def __init__(self, client) -> None:
        self._client = client

    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        full_key = f"ratelimit:{key}"
        count = self._client.incr(full_key)
        if count == 1:
            self._client.expire(full_key, window_seconds)
        if count > limit:
            ttl = self._client.ttl(full_key)
            retry_after = ttl if ttl and ttl > 0 else window_seconds
            return False, retry_after
        return True, 0

    def reset(self, key: str) -> None:
        self._client.delete(f"ratelimit:{key}")


def _build_backend() -> RateLimitBackend:
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url:
        return InMemoryRateLimitBackend()
    try:
        import redis  # optional dependency; only required when REDIS_URL is set
        client = redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        logger.info("Rate limiting is backed by Redis")
        return RedisRateLimitBackend(client)
    except Exception:
        logger.exception(
            "REDIS_URL is set but Redis could not be reached (or the `redis` "
            "package is not installed); falling back to in-process rate "
            "limiting. This is NOT safe with more than one API instance."
        )
        return InMemoryRateLimitBackend()


_backend: RateLimitBackend = _build_backend()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `key` exceeds `limit` hits inside `window_seconds`."""
    allowed, retry_after = _backend.hit(key, limit, window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again in a few minutes.",
            headers={"Retry-After": str(retry_after)},
        )


def reset_rate_limit(key: str) -> None:
    """Called after a successful sign-in so one bad typo streak doesn't
    keep counting against a user who then got it right."""
    _backend.reset(key)
