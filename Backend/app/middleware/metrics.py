"""Records every request's status code and latency into app.observability's
http_metrics, for the /metrics endpoint. Deliberately minimal: no per-user
or per-path labels stored long-term (path could be high-cardinality with
dynamic segments like conversation ids), just counts/status/latency."""
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.observability import http_metrics


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            http_metrics.record(500, (time.monotonic() - start) * 1000)
            raise
        http_metrics.record(response.status_code, (time.monotonic() - start) * 1000)
        return response
