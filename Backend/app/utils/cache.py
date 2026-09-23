"""Read-through cache for a handful of read-heavy, cheap-to-recompute
endpoints (user profile, project list, pricing plans, memory context),
with the same pluggable-backend shape as app/utils/rate_limit.py:

  - InMemoryCacheBackend (default): a dict in this worker's own memory.
    Fine for a single instance; a restart or a second instance simply
    means a fresh (empty) cache, never stale data shared incorrectly.

  - RedisCacheBackend: the same get/set/delete, backed by Redis, so every
    API instance shares one cache and one invalidation. Selected
    automatically when REDIS_URL is set and reachable; any problem (no
    REDIS_URL, unreachable Redis, `redis` package not installed) falls
    back to the in-memory backend with a logged warning, same as
    rate_limit.py.

CACHE_ENABLED gates all of it: off by default in dev (so local runs never
see stale reads while iterating), on by default once ENV=production. Can
be overridden explicitly either way via the env var itself.

Every cached value carries a short TTL (see CACHE_DEFAULT_TTL_SECONDS) as
the primary safety net against a missed invalidation somewhere in the
codebase -- explicit `cache_delete()`/`cache_delete_many()` calls on the
known write paths (see call sites) are the fast path, the TTL is the
backstop for anything not yet covered.
"""
import json
import logging
import os
import threading
import time
from typing import Any, Dict, Iterable, Optional, Protocol, Tuple

from app.utils.request_context import record_cache_hit

logger = logging.getLogger("Cache")

CACHE_DEFAULT_TTL_SECONDS = 60


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


CACHE_ENABLED = _bool_env("CACHE_ENABLED", default=(os.getenv("ENV") == "production"))


class _Counters:
    """Process-local hit/miss counters for GET /metrics. Deliberately not
    shared across instances (like http_metrics) -- a per-instance view of
    cache effectiveness is what you'd act on anyway."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def hit(self) -> None:
        with self._lock:
            self.hits += 1

    def miss(self) -> None:
        with self._lock:
            self.misses += 1

    def snapshot(self) -> Tuple[int, int]:
        with self._lock:
            return self.hits, self.misses


counters = _Counters()


class CacheBackend(Protocol):
    def get(self, key: str) -> Optional[str]: ...
    def set(self, key: str, value: str, ttl_seconds: int) -> None: ...
    def delete(self, key: str) -> None: ...


class InMemoryCacheBackend:
    def __init__(self) -> None:
        self._store: Dict[str, Tuple[float, str]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() >= expires_at:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: str, ttl_seconds: int) -> None:
        with self._lock:
            self._store[key] = (time.time() + ttl_seconds, value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)


class RedisCacheBackend:
    def __init__(self, client) -> None:
        self._client = client

    def get(self, key: str) -> Optional[str]:
        value = self._client.get(f"cache:{key}")
        return value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else value

    def set(self, key: str, value: str, ttl_seconds: int) -> None:
        self._client.set(f"cache:{key}", value, ex=ttl_seconds)

    def delete(self, key: str) -> None:
        self._client.delete(f"cache:{key}")


def _build_backend() -> CacheBackend:
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url:
        logger.warning("cache backend: in-process (dev only) -- REDIS_URL not set")
        return InMemoryCacheBackend()
    try:
        import redis  # optional dependency; only required when REDIS_URL is set
        client = redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        logger.info("cache backend: redis")
        return RedisCacheBackend(client)
    except Exception:
        logger.exception(
            "cache backend: in-process fallback (REDIS_URL is set but Redis "
            "could not be reached, or the `redis` package is not installed)."
        )
        return InMemoryCacheBackend()


_backend: CacheBackend = _build_backend()
# Same reasoning as rate_limit.py's _local_fallback: a Redis outage that
# happens after startup (not just at _build_backend() time) still needs
# somewhere safe to land instead of turning every cached read into a 500.
_local_fallback = InMemoryCacheBackend()


def cache_get(key: str) -> Optional[Any]:
    """Returns the cached, JSON-decoded value for `key`, or None on a miss,
    a disabled cache, or any backend error (a cache must never be a new
    way for a read endpoint to fail)."""
    if not CACHE_ENABLED:
        return None
    try:
        raw = _backend.get(key)
    except Exception:
        logger.exception("cache backend unavailable on get(); falling back to in-process for this call")
        try:
            raw = _local_fallback.get(key)
        except Exception:
            raw = None
    if raw is None:
        counters.miss()
        return None
    counters.hit()
    record_cache_hit()
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def cache_set(key: str, value: Any, ttl_seconds: int = CACHE_DEFAULT_TTL_SECONDS) -> None:
    if not CACHE_ENABLED:
        return
    try:
        raw = json.dumps(value, default=str)
    except (TypeError, ValueError):
        return
    try:
        _backend.set(key, raw, ttl_seconds)
    except Exception:
        logger.exception("cache backend unavailable on set(); falling back to in-process for this call")
        try:
            _local_fallback.set(key, raw, ttl_seconds)
        except Exception:
            pass


def cache_delete(key: str) -> None:
    """Best-effort: a failed invalidation should never fail the write path
    that triggered it -- the TTL still bounds how long a stale read lasts."""
    for backend in (_backend, _local_fallback):
        try:
            backend.delete(key)
        except Exception:
            logger.exception("cache backend unavailable on delete()")


def cache_delete_many(keys: Iterable[str]) -> None:
    for key in keys:
        cache_delete(key)
