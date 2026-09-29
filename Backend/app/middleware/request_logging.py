"""B13: one structured log line per request (request_id, user_id if
authed, method, path, status, latency_ms, db_query_count, cache_hit), plus
feeding app.observability's per-route status counters for GET /metrics.
Separate from MetricsMiddleware (app/middleware/metrics.py), which only
tracks the global request/latency/status counters used for alerting --
this one is about a single request's own story, for debugging."""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.observability import route_status_counters
from app.utils.request_context import get_request_counters, start_request_counters, stop_request_counters

logger = logging.getLogger("RequestLog")


def _best_effort_user_id(request: Request):
    """Read-only, never enforces auth: an invalid/missing/expired token
    just means user_id is None in the log line, same as an anonymous
    request. The real auth check still happens in get_current_user."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    try:
        from app.auth.jwt import decode_access_token
        payload = decode_access_token(token)
        return payload.get("sub") if payload else None
    except Exception:
        return None


def _route_pattern(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", request.url.path)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        start = time.monotonic()
        tokens = start_request_counters()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            latency_ms = (time.monotonic() - start) * 1000
            db_query_count, cache_hit = get_request_counters()
            stop_request_counters(tokens)
            route_status_counters.record(request.method, _route_pattern(request), status_code)
            logger.info(
                "request",
                extra={
                    "request_id": request_id,
                    "user_id": _best_effort_user_id(request),
                    "method": request.method,
                    "path": request.url.path,
                    "status": status_code,
                    "latency_ms": round(latency_ms, 1),
                    "db_query_count": db_query_count,
                    "cache_hit": cache_hit,
                },
            )
