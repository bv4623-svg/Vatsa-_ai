"""App-wide HTTP metrics and readiness checks -- separate from
app/ai_router/metrics.py, which tracks AI-request-specific counters only.
Both are exposed together on GET /metrics (admin-gated, see main.py).

No per-user data and no secrets in any of this: request counts, status
codes, latency and path/method labels only.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, Tuple

from sqlalchemy import text

logger = logging.getLogger("Observability")

_BUCKETS_MS = (10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000)


class HttpMetrics:
    """Same fixed-window-free counter/histogram approach as
    app/ai_router/metrics.py, kept as a separate instance so an AI-request
    spike and a general HTTP spike can't be confused for each other."""

    def __init__(self) -> None:
        self._request_count = 0
        self._error_count = 0
        self._status_counts: Dict[int, int] = {}
        self._latencies_ms: list = []  # bounded below
        self._max_samples = 5000  # a rolling cap, not a leak

    def record(self, status_code: int, latency_ms: float) -> None:
        self._request_count += 1
        if status_code >= 500:
            self._error_count += 1
        self._status_counts[status_code] = self._status_counts.get(status_code, 0) + 1
        self._latencies_ms.append(latency_ms)
        if len(self._latencies_ms) > self._max_samples:
            self._latencies_ms = self._latencies_ms[-self._max_samples:]

    def _percentile(self, p: float) -> float:
        if not self._latencies_ms:
            return 0.0
        s = sorted(self._latencies_ms)
        idx = min(len(s) - 1, int(len(s) * p))
        return round(s[idx], 1)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "request_count": self._request_count,
            "error_count": self._error_count,
            "status_counts": dict(self._status_counts),
            "latency_ms": {
                "p50": self._percentile(0.50),
                "p95": self._percentile(0.95),
                "p99": self._percentile(0.99),
                "samples": len(self._latencies_ms),
            },
        }

    def prometheus(self) -> str:
        lines = [
            f"http_requests_total {self._request_count}",
            f"http_errors_total {self._error_count}",
        ]
        for code, count in sorted(self._status_counts.items()):
            lines.append(f'http_requests_by_status_total{{status="{code}"}} {count}')
        lines.append(f"http_request_duration_ms_p50 {self._percentile(0.50)}")
        lines.append(f"http_request_duration_ms_p95 {self._percentile(0.95)}")
        lines.append(f"http_request_duration_ms_p99 {self._percentile(0.99)}")
        return "\n".join(lines) + "\n"


http_metrics = HttpMetrics()


class RouteStatusCounters:
    """HTTP status code counts broken down by matched ROUTE PATTERN (e.g.
    "/api/conversations/{conv_id}", not the resolved "/api/conversations/
    7f3a..."). Route patterns are a small, fixed set (one per registered
    endpoint) fixed at startup, so this can't grow unbounded the way
    counting by raw resolved path could -- see app/middleware/
    request_logging.py, which is the only writer."""

    def __init__(self) -> None:
        self._counts: Dict[Tuple[str, str, int], int] = {}
        self._lock = threading.Lock()

    def record(self, method: str, route_pattern: str, status_code: int) -> None:
        key = (method, route_pattern, status_code)
        with self._lock:
            self._counts[key] = self._counts.get(key, 0) + 1

    def prometheus(self) -> str:
        lines = []
        for (method, route, status), count in sorted(self._counts.items()):
            lines.append(
                f'http_requests_by_route_total{{method="{method}",route="{route}",status="{status}"}} {count}'
            )
        return "\n".join(lines) + ("\n" if lines else "")


route_status_counters = RouteStatusCounters()


def db_pool_status() -> Dict[str, Any]:
    """Safe on SQLite too (NullPool-like single connection; the pool
    attributes below simply won't all exist, so this degrades gracefully)."""
    from app.database import engine
    pool = engine.pool
    status: Dict[str, Any] = {"dialect": engine.dialect.name}
    for attr in ("size", "checkedin", "checkedout", "overflow"):
        fn = getattr(pool, attr, None)
        if callable(fn):
            try:
                status[attr] = fn()
            except Exception:
                pass
    return status


def check_database(timeout_s: float = 3.0) -> bool:
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Readiness check: database unreachable")
        return False
    finally:
        db.close()


def check_redis() -> "str":
    """Returns 'ok', 'not_configured', or 'unreachable'. Never raises."""
    import os
    if not (os.getenv("REDIS_URL") or "").strip():
        return "not_configured"
    try:
        from app.utils.rate_limit import _backend, RedisRateLimitBackend
        if not isinstance(_backend, RedisRateLimitBackend):
            return "unreachable"  # configured, but this process fell back
        _backend._client.ping()
        return "ok"
    except Exception:
        logger.exception("Readiness check: Redis unreachable")
        return "unreachable"


def check_email_configured() -> bool:
    """Configuration presence only, not a live SMTP probe -- readiness may
    be polled often, and a real handshake against Gmail on every poll would
    be slow and could look like abuse to the mail provider. See
    app/utils/email/core.py for the real send path this mirrors."""
    import os
    return bool(os.getenv("EMAIL_USERNAME")) and bool(os.getenv("EMAIL_PASSWORD"))
