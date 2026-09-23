"""Strategy name -> instance, and the AI_ROUTER_STRATEGY lookup."""
from __future__ import annotations

from typing import Callable, Dict, Mapping, Optional

from app.ai_router.strategy.base import Strategy, logger
from app.ai_router.strategy.hybrid import HybridStrategy
from app.ai_router.strategy.simple import CostStrategy, LatencyStrategy, LoadStrategy, PriorityStrategy

_STRATEGIES: Dict[str, Callable[[Optional[Mapping[str, float]]], Strategy]] = {
    "priority": lambda w: PriorityStrategy(),
    "cost": lambda w: CostStrategy(),
    "latency": lambda w: LatencyStrategy(),
    "load": lambda w: LoadStrategy(),
    "hybrid": lambda w: HybridStrategy(w),
}


def build_strategy(name: Optional[str], weights: Optional[Mapping[str, float]] = None) -> Strategy:
    key = (name or "priority").strip().lower()
    factory = _STRATEGIES.get(key)
    if factory is None:
        logger.warning("Unknown AI_ROUTER_STRATEGY %r; using 'priority'", key)
        factory = _STRATEGIES["priority"]
    return factory(weights)
