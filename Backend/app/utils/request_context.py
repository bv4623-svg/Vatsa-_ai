"""Per-request counters (DB query count, whether any cache lookup hit)
that need to be readable from the outermost middleware after the whole
request has run, even though the actual increments happen deep inside a
route/service/SQLAlchemy internals, and even though a *sync* route runs in
FastAPI's threadpool while the middleware itself runs on the event loop.

Each ContextVar holds a small MUTABLE list, never reassigned once set.
contextvars.copy_context() (which is what both anyio's to_thread.run_sync,
used for sync routes, and normal async call chains use) copies the
variable *binding* -- a reference to that same list object -- not a deep
copy of the list's contents. So a write from inside the threadpool (or
from a nested async call) mutates the one shared object, and the
middleware, holding its own binding to that same object, sees the update
after call_next() returns. Reassigning the ContextVar itself (`.set(...)`
again) would NOT have this property -- only in-place mutation of the
held object does.
"""
from contextvars import ContextVar
from typing import List, Optional

_db_query_count: ContextVar[Optional[List[int]]] = ContextVar("db_query_count", default=None)
_cache_hit: ContextVar[Optional[List[bool]]] = ContextVar("cache_hit", default=None)


def start_request_counters():
    """Call once at the top of the request-logging middleware. Returns an
    opaque token pair to pass to stop_request_counters()."""
    db_token = _db_query_count.set([0])
    cache_token = _cache_hit.set([False])
    return db_token, cache_token


def stop_request_counters(tokens) -> None:
    db_token, cache_token = tokens
    _db_query_count.reset(db_token)
    _cache_hit.reset(cache_token)


def get_request_counters():
    """Returns (db_query_count, cache_hit) for the currently active
    request, or (0, False) if called outside one (e.g. a background task
    or a direct unit-test call with no request in flight)."""
    db_counter = _db_query_count.get()
    cache_counter = _cache_hit.get()
    return (db_counter[0] if db_counter is not None else 0), (cache_counter[0] if cache_counter is not None else False)


def record_db_query() -> None:
    """Called from a SQLAlchemy engine event listener on every statement
    execution -- see app/database.py. A no-op outside an active request
    (no ContextVar set), e.g. a scheduled task's own DB session."""
    counter = _db_query_count.get()
    if counter is not None:
        counter[0] += 1


def record_cache_hit() -> None:
    """Called from app/utils/cache.py's cache_get() on every hit."""
    counter = _cache_hit.get()
    if counter is not None:
        counter[0] = True
