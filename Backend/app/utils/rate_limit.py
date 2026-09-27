"""Small fixed-window rate limiter for auth endpoints.

In-process only: counters live in this worker's memory, so with multiple
workers the effective limit is (limit x worker count), and a restart
clears them. That is enough to blunt credential stuffing against a single
instance; a multi-instance deployment should move this to Redis.
"""

import os
import threading
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request

# key -> (window_start, count, window_seconds)
_buckets: Dict[str, Tuple[float, int, int]] = {}
_lock = threading.Lock()
_calls = 0
# Every PRUNE_EVERY calls, buckets whose window has expired are dropped, so
# one entry per IP/email ever seen doesn't accumulate for the process's life.
PRUNE_EVERY = 1000


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


def _prune(now: float) -> None:
    expired = [k for k, (start, _count, window) in _buckets.items() if now - start >= window]
    for k in expired:
        del _buckets[k]


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `key` exceeds `limit` hits inside `window_seconds`."""
    global _calls
    now = time.time()
    with _lock:
        _calls += 1
        if _calls % PRUNE_EVERY == 0:
            _prune(now)

        window_start, count, _ = _buckets.get(key, (now, 0, window_seconds))

        if now - window_start >= window_seconds:
            window_start, count = now, 0

        count += 1
        _buckets[key] = (window_start, count, window_seconds)

        if count > limit:
            retry_after = int(window_seconds - (now - window_start)) + 1
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Try again in a few minutes.",
                headers={"Retry-After": str(retry_after)},
            )


def reset_rate_limit(key: str) -> None:
    """Called after a successful sign-in so one bad typo streak doesn't
    keep counting against a user who then got it right."""
    with _lock:
        _buckets.pop(key, None)
