"""Single shared Redis client, used by cache.py, rate_limit.py and
locking.py instead of each module opening its own separate connection to
the same Redis server -- on a small deployment (e.g. Render's free tier
talking to Upstash) three independent connections cost real memory and
socket overhead for no benefit over one.

Built lazily on first call (not at import time), so importing this module
costs nothing when REDIS_URL is unset. get_redis_client() returns None
(never raises) on any failure -- every caller already has its own
in-process fallback for exactly that case, same as before this module
existed.

manager.py's RedisJobStore is the one exception: APScheduler's own
RedisJobStore builds its own internal connection from host/port/db/
password kwargs rather than accepting a pre-built client object, so it
cannot literally reuse this module's client -- it still calls
get_redis_client() first, though, so the one-time connect+ping probe
(and its retry loop) isn't duplicated a second time just to extract
those kwargs.
"""
import logging
import os
import time
from typing import Optional

logger = logging.getLogger("RedisClient")

_client = None
_attempted = False

# Generous enough for a shared/throttled free-tier instance talking to a
# managed Redis over the public internet (Upstash), short enough that a
# genuinely dead endpoint still fails fast rather than blocking startup.
_SOCKET_TIMEOUT = 5
_CONNECT_TIMEOUT = 5
_CONNECT_ATTEMPTS = 3
_RETRY_DELAY_SECONDS = 1


def get_redis_client():
    """Returns the shared redis-py client, building and ping-testing it on
    first call. Cached after that (including a cached None on failure) --
    call sites already re-check reachability per-operation via their own
    try/except, so retrying a connection that's already known dead on
    every single cache/rate-limit/lock call would just add latency."""
    global _client, _attempted
    if _attempted:
        return _client
    _attempted = True

    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url:
        return None

    try:
        import redis  # optional dependency; only required when REDIS_URL is set
    except ImportError:
        logger.warning("redis client: `redis` package not installed")
        return None

    last_exc: Optional[Exception] = None
    for attempt in range(1, _CONNECT_ATTEMPTS + 1):
        try:
            client = redis.Redis.from_url(
                redis_url,
                socket_timeout=_SOCKET_TIMEOUT,
                socket_connect_timeout=_CONNECT_TIMEOUT,
                socket_keepalive=True,
                health_check_interval=30,
            )
            client.ping()
            logger.info("redis client: connected (attempt %d/%d)", attempt, _CONNECT_ATTEMPTS)
            _client = client
            return _client
        except Exception as exc:
            last_exc = exc
            if attempt < _CONNECT_ATTEMPTS:
                logger.warning(
                    "redis client: connect attempt %d/%d failed (%s); retrying in %ds",
                    attempt, _CONNECT_ATTEMPTS, exc, _RETRY_DELAY_SECONDS,
                )
                time.sleep(_RETRY_DELAY_SECONDS)

    logger.warning("redis client: all %d connection attempts failed (%s)", _CONNECT_ATTEMPTS, last_exc)
    _client = None
    return None
