"""Small fixed-window rate limiter for auth endpoints.

In-process only: counters live in this worker's memory, so with multiple
workers the effective limit is (limit x worker count), and a restart
clears them. That is enough to blunt credential stuffing against a single
instance; a multi-instance deployment should move this to Redis.
"""

import threading
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request

_buckets: Dict[str, Tuple[float, int]] = {}
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `key` exceeds `limit` hits inside `window_seconds`."""
    now = time.time()
    with _lock:
        window_start, count = _buckets.get(key, (now, 0))

        if now - window_start >= window_seconds:
            window_start, count = now, 0

        count += 1
        _buckets[key] = (window_start, count)

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
