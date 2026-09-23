"""Routing strategies: how eligible models are ordered.

A strategy only orders candidates. It never filters them and never calls a
provider, so every strategy can be swapped without touching the engine.

    priority  the order declared in the route (the default; same as before the router)
    cost      cheapest first (models with no configured price go last)
    latency   fastest first, from measured latency, else the model's latency_profile
    load      fewest calls currently in flight on this instance first
    hybrid    a weighted blend of cost, latency, load, availability and priority

Ties always keep the declared order, so results are deterministic.

Split into base.py/simple.py/hybrid.py/registry.py; every public name is
re-exported here so `from app.ai_router.strategy import X` keeps working
exactly as it did when this was one file.
"""
from app.ai_router.strategy.base import Strategy, StrategyContext
from app.ai_router.strategy.simple import CostStrategy, LatencyStrategy, LoadStrategy, PriorityStrategy
from app.ai_router.strategy.hybrid import DEFAULT_HYBRID_WEIGHTS, HybridStrategy, parse_weights
from app.ai_router.strategy.registry import build_strategy

__all__ = [
    "Strategy",
    "StrategyContext",
    "PriorityStrategy",
    "CostStrategy",
    "LatencyStrategy",
    "LoadStrategy",
    "HybridStrategy",
    "DEFAULT_HYBRID_WEIGHTS",
    "parse_weights",
    "build_strategy",
]
