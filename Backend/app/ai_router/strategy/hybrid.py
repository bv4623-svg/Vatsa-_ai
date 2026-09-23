"""The weighted-blend strategy, and parsing its weights from AI_ROUTER_WEIGHTS."""
from __future__ import annotations

from typing import Dict, List, Mapping, Optional, Sequence

from app.ai_router.strategy.base import Strategy, StrategyContext, _expected_latency, _normalize, _unit_cost, logger
from app.ai_router.types import ModelSpec

DEFAULT_HYBRID_WEIGHTS: Mapping[str, float] = {
    "cost": 0.30,
    "latency": 0.30,
    "load": 0.15,
    "availability": 0.15,
    "priority": 0.10,
}


class HybridStrategy(Strategy):
    name = "hybrid"

    def __init__(self, weights: Optional[Mapping[str, float]] = None) -> None:
        merged = dict(DEFAULT_HYBRID_WEIGHTS)
        merged.update(weights or {})
        self.weights: Dict[str, float] = merged

    def scores(self, specs: Sequence[ModelSpec], ctx: StrategyContext) -> List[float]:
        w = self.weights
        cost = _normalize([_unit_cost(s) for s in specs])
        latency = _normalize([_expected_latency(s, ctx) for s in specs])
        load = _normalize([float(ctx.inflight.count(s.id)) for s in specs])
        unavailable = _normalize([1.0 - ctx.health.availability(s.id) for s in specs])
        priority = _normalize([float(s.priority) for s in specs])
        return [
            w["cost"] * cost[i]
            + w["latency"] * latency[i]
            + w["load"] * load[i]
            + w["availability"] * unavailable[i]
            + w["priority"] * priority[i]
            for i in range(len(specs))
        ]

    def order(self, specs, ctx):
        scored = list(zip(self.scores(specs, ctx), range(len(specs)), specs))
        scored.sort(key=lambda t: (t[0], t[1]))  # index breaks ties: declared order
        return [spec for _, _, spec in scored]


def parse_weights(raw: Optional[str]) -> Dict[str, float]:
    """'cost=0.5,latency=0.2' -> {'cost': 0.5, 'latency': 0.2}. Bad entries are
    ignored with a warning rather than failing startup."""
    weights: Dict[str, float] = {}
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        name, _, value = part.partition("=")
        name = name.strip().lower()
        try:
            number = float(value)
        except ValueError:
            number = -1.0
        if name not in DEFAULT_HYBRID_WEIGHTS or number < 0:
            logger.warning("Ignoring hybrid weight %r (expected name=number, name in %s)",
                           part, sorted(DEFAULT_HYBRID_WEIGHTS))
            continue
        weights[name] = number
    return weights
