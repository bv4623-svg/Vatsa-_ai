"""app/utils/request_context.py's counters must survive a hop through a
real threadpool thread (how FastAPI runs a sync `def` route) as well as a
plain async call chain -- see the module's own docstring for why a naive
ContextVar wouldn't."""
import concurrent.futures
import contextvars

from app.utils.request_context import (
    start_request_counters, stop_request_counters, get_request_counters,
    record_db_query, record_cache_hit,
)


def test_counters_start_at_zero_and_false():
    tokens = start_request_counters()
    try:
        assert get_request_counters() == (0, False)
    finally:
        stop_request_counters(tokens)


def test_record_db_query_increments_within_the_same_context():
    tokens = start_request_counters()
    try:
        record_db_query()
        record_db_query()
        db_count, _ = get_request_counters()
        assert db_count == 2
    finally:
        stop_request_counters(tokens)


def test_record_cache_hit_sets_the_flag():
    tokens = start_request_counters()
    try:
        assert get_request_counters()[1] is False
        record_cache_hit()
        assert get_request_counters()[1] is True
    finally:
        stop_request_counters(tokens)


def test_no_active_request_context_is_a_safe_no_op():
    record_db_query()  # must not raise
    record_cache_hit()  # must not raise
    assert get_request_counters() == (0, False)


def test_counters_survive_a_hop_through_a_real_threadpool_thread():
    """Mirrors how Starlette/anyio actually runs a sync `def` route: the
    current context is copied into a worker thread via
    contextvars.Context.run(); mutations inside that thread must still be
    visible to the caller once the thread finishes."""
    tokens = start_request_counters()
    try:
        ctx = contextvars.copy_context()

        def do_work_in_thread():
            record_db_query()
            record_db_query()
            record_db_query()
            record_cache_hit()

        with concurrent.futures.ThreadPoolExecutor() as pool:
            pool.submit(ctx.run, do_work_in_thread).result()

        db_count, cache_hit = get_request_counters()
        assert db_count == 3
        assert cache_hit is True
    finally:
        stop_request_counters(tokens)
