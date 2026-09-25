"""Candidate planning: which models may serve a request, and in what order.

    1. Start from the route the request names (unknown names use the default route).
    2. Drop models that are disabled or lack a required capability.
    3. If nothing is left and the request needs vision, use the "vision" route's models.
    4. Order them: a pinned route keeps its primary first and lets the strategy
       order the fallbacks; an unpinned route lets the strategy order everything.
    5. If fallback is off (globally, per request, or for the route) keep one model.

The engine walks the returned list in order, skipping open circuits.
"""
from __future__ import annotations

from typing import List

from app.ai_router.errors import NoEligibleModel
from app.ai_router.registry import ModelRegistry, RoutePlan
from app.ai_router.strategy import Strategy, StrategyContext
from app.ai_router.types import Capability, ModelSpec, RouteRequest

VISION_ROUTE = "vision"


def _eligible(plan: RoutePlan, request: RouteRequest) -> List[ModelSpec]:
    return [m for m in plan.candidates() if m.enabled and m.supports(request.required)]


def plan_candidates(
    registry: ModelRegistry,
    request: RouteRequest,
    strategy: Strategy,
    ctx: StrategyContext,
    *,
    fallback_enabled: bool = True,
) -> List[ModelSpec]:
    plan = registry.resolve(request.route)
    candidates = _eligible(plan, request)

    if not candidates and Capability.VISION in request.required:
        plan = registry.resolve(VISION_ROUTE)
        candidates = _eligible(plan, request)

    if not candidates:
        raise NoEligibleModel()

    if plan.pinned and candidates[0].id == plan.primary.id:
        ordered = [candidates[0], *strategy.order(candidates[1:], ctx)]
    else:
        ordered = strategy.order(candidates, ctx)

    if not (fallback_enabled and request.allow_fallback and plan.allow_fallback):
        ordered = ordered[:1]
    return ordered
