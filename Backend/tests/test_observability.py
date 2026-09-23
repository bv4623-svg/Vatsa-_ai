"""app/observability.py and the two middlewares that feed it
(app/middleware/metrics.py, app/middleware/timeout.py), plus /health,
/ready and /metrics."""
import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.timeout import RequestTimeoutMiddleware
import app.middleware.timeout as timeout_mod


def test_health_is_ok_and_fast(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ready_reports_database_and_redis_state(client):
    res = client.get("/ready")
    assert res.status_code in (200, 503)
    body = res.json()
    assert body["checks"]["database"] == "ok"  # the test DB is always reachable
    assert body["checks"]["redis"] in ("ok", "not_configured", "unreachable")


def test_metrics_is_prometheus_text_and_has_no_provider_names(client):
    client.get("/health")  # generate at least one recorded request
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "http_requests_total" in res.text
    lowered = res.text.lower()
    for term in ("claude", "anthropic", "openai", "gemini", "openrouter", "deepseek"):
        assert term not in lowered


def test_request_timeout_middleware_returns_504_for_a_slow_handler(monkeypatch):
    monkeypatch.setattr(timeout_mod, "REQUEST_TIMEOUT_SECONDS", 0.05)

    app = FastAPI()
    app.add_middleware(RequestTimeoutMiddleware)

    @app.get("/slow")
    async def slow():
        await asyncio.sleep(1)
        return {"ok": True}

    @app.get("/fast")
    async def fast():
        return {"ok": True}

    with TestClient(app) as client:
        assert client.get("/fast").status_code == 200
        res = client.get("/slow")
        assert res.status_code == 504
