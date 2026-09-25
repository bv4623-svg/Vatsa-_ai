"""Admin-only visibility into the Router Engine: circuit breaker state,
per-model health and latency, and request counters. Names real provider and
model identifiers, so it is gated behind require_admin like every other
endpoint that can see across users -- see app/auth/dependencies/admin.py for
what that requires (verified admin email, a real session token, 2FA)."""
import logging

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies.admin import require_admin
from app.ai_router import get_router
from app.models.user import User

logger = logging.getLogger("AIRouterStatus")
router = APIRouter(prefix="/api/admin/ai-router", tags=["admin"])


@router.get("/status")
async def router_status(
    check_providers: bool = Query(False, description="Also run each adapter's health_check() now"),
    _admin: User = Depends(require_admin),
):
    engine = get_router()
    provider_checks = {}
    if check_providers:
        try:
            await engine.check_provider_health()
        except Exception:
            logger.exception("Active provider health check failed")
    provider_checks = engine.health.provider_checks()

    return {
        "config": {
            "default_route": engine.registry.canonical_route(None),
            "strategy": engine.strategy_name,
            "fallback_enabled": engine.config.fallback_enabled,
            "max_inflight": engine.config.max_inflight,
        },
        "routes": engine.registry.route_names(),
        "models": engine.health.snapshot(engine.registry),
        "breakers": engine.breaker_states(),
        "inflight_total": engine.inflight_total,
        "admission_inflight": engine.admission_inflight,
        "provider_checks": provider_checks,
        "metrics": engine.metrics.snapshot(),
    }


@router.get("/metrics")
async def router_metrics_prometheus(_admin: User = Depends(require_admin)):
    """Prometheus text exposition format, still admin-gated (it carries
    provider/model labels) rather than a public /metrics endpoint."""
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(get_router().metrics.prometheus(), media_type="text/plain; version=0.0.4")
