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

Per-IP keys use client_ip(), which only trusts the X-Forwarded-For entries
added by our own proxies (TRUSTED_PROXY_COUNT), so a client can't dodge
per-IP limits by sending fake addresses.
"""

import logging
import os
import threading
import time
from typing import Dict, Protocol, Tuple

from fastapi import HTTPException, Request

logger = logging.getLogger("RateLimit")

# Every PRUNE_EVERY hits, the in-memory backend drops buckets whose window has
# expired, so one entry per IP/email ever seen doesn't accumulate for the
# process's life.
PRUNE_EVERY = 1000


class RateLimitBackend(Protocol):
    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """Records one hit against `key`. Returns (allowed, retry_after_seconds)."""
        ...

    def reset(self, key: str) -> None:
        ...


class InMemoryRateLimitBackend:
    def __init__(self) -> None:
        # key -> (window_start, count, window_seconds)
        self._buckets: Dict[str, Tuple[float, int, int]] = {}
        self._lock = threading.Lock()
        self._calls = 0

    def _prune(self, now: float) -> None:
        expired = [k for k, (start, _count, window) in self._buckets.items() if now - start >= window]
        for k in expired:
            del self._buckets[k]

    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        with self._lock:
            self._calls += 1
            if self._calls % PRUNE_EVERY == 0:
                self._prune(now)
            window_start, count, _ = self._buckets.get(key, (now, 0, window_seconds))
            if now - window_start >= window_seconds:
                window_start, count = now, 0
            count += 1
            self._buckets[key] = (window_start, count, window_seconds)
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
    from app.utils.redis_client import get_redis_client

    client = get_redis_client()
    if client is None:
        logger.warning(
            "rate_limiter backend: in-process (REDIS_URL not set or Redis "
            "unreachable). This is NOT safe with more than one API instance."
        )
        return InMemoryRateLimitBackend()
    logger.info("rate_limiter backend: redis")
    return RedisRateLimitBackend(client)


_backend: RateLimitBackend = _build_backend()

# Always available regardless of what _backend is, so a Redis outage that
# happens AFTER startup (as opposed to REDIS_URL being unreachable when
# _build_backend() ran) has somewhere safe to fall back to. _build_backend()
# only handles the startup case -- once _backend is a RedisRateLimitBackend,
# it stays that object for the rest of the process, so a later connection
# error from Redis itself would otherwise propagate out of enforce_rate_limit
# as a 500 on every rate-limited endpoint (login, OTP, 2FA, ...) instead of
# degrading. See tests/test_rate_limit_backends.py.
_local_fallback = InMemoryRateLimitBackend()

# The in-process counters (the primary backend's when there is no Redis):
# tests inspect and clear them.
_buckets = (_backend if isinstance(_backend, InMemoryRateLimitBackend) else _local_fallback)._buckets


def _trusted_proxy_count() -> int:
    """How many reverse proxies sit in front of this app and append to
    X-Forwarded-For. 1 for Render (the production host); set 0 when the app
    is exposed directly, where the header is entirely client-controlled."""
    try:
        return max(0, int(os.getenv("TRUSTED_PROXY_COUNT") or "1"))
    except ValueError:
        return 1


def client_ip(request: Request) -> str:
    """The client address as seen by the outermost trusted proxy.

    Each proxy APPENDS the address it received the connection from, so the
    real client is the Nth entry from the RIGHT (N = trusted proxies).
    Entries further left were sent by the client and can be forged; using
    the first entry let an attacker rotate fake IPs to dodge per-IP limits.
    """
    peer = request.client.host if request.client else "unknown"
    hops = _trusted_proxy_count()
    forwarded = request.headers.get("x-forwarded-for")
    if hops == 0 or not forwarded:
        return peer
    parts = [p.strip() for p in forwarded.split(",") if p.strip()]
    if len(parts) < hops:
        return peer
    return parts[-hops]


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `key` exceeds `limit` hits inside `window_seconds`."""
    try:
        allowed, retry_after = _backend.hit(key, limit, window_seconds)
    except Exception:
        # Never let a transport error from the rate limiter itself take down
        # an unrelated request. Falls back to per-process limiting for this
        # call rather than either crashing or (worse) silently allowing
        # unlimited attempts through.
        logger.exception("rate_limiter backend unavailable mid-request; falling back to in-process for this call")
        allowed, retry_after = _local_fallback.hit(key, limit, window_seconds)
    if not allowed:
        # Short waits get an exact count (useful for a resend-code cooldown);
        # longer ones keep the vaguer phrasing -- "try again in 823 seconds"
        # reads worse than "in a few minutes" once it's more than ~a minute and
        # a half out.
        message = (
            f"Too many attempts. Try again in {retry_after} seconds."
            if retry_after <= 90
            else "Too many attempts. Try again in a few minutes."
        )
        raise HTTPException(
            status_code=429,
            detail=message,
            headers={"Retry-After": str(retry_after)},
        )


def reset_rate_limit(key: str) -> None:
    """Called after a successful sign-in so one bad typo streak doesn't
    keep counting against a user who then got it right. Clears both the
    primary backend and the local fallback -- if Redis was briefly down
    during the earlier failed attempts, the count could be sitting in
    either one."""
    for backend in {id(_backend): _backend, id(_local_fallback): _local_fallback}.values():
        try:
            backend.reset(key)
        except Exception:
            logger.exception("rate_limiter backend unavailable; could not reset a key on it")
