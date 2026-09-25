"""Routing strategies: how eligible models are ordered.

A strategy only orders candidates. It never filters them and never calls a
provider, so every strategy can be swapped without touching the engine.

    priority  the order declared in the route (the default; same as before the router)
    cost      cheapest first (models with no configured price go last)
    latency   fastest first, from measured latency, else the model's latency_profile
    load      fewest calls currently in flight on this instance first
    hybrid    a weighted blend of cost, latency, load, availability and priority

Ties always keep the declared order, so results are deterministic.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable, Dict, List, Mapping, Optional, Sequence

from app.ai_router.health import HealthTracker
from app.ai_router.load_balancer import InFlightTracker
from app.ai_router.types import ModelSpec

logger = logging.getLogger("AIRouter.strategy")

# Used only until a model has measured latency.
_PROFILE_MS = {"fast": 500.0, "medium": 2000.0, "slow": 8000.0}

DEFAULT_HYBRID_WEIGHTS: Mapping[str, float] = {
    "cost": 0.30,
    "latency": 0.30,
    "load": 0.15,
    "availability": 0.15,
    "priority": 0.10,
}


@dataclass(frozen=True)
class StrategyContext:
    health: HealthTracker
    inflight: InFlightTracker


class Strategy:
    name = "base"

    def order(self, specs: Sequence[ModelSpec], ctx: StrategyContext) -> List[ModelSpec]:
        raise NotImplementedError


def _expected_latency(spec: ModelSpec, ctx: StrategyContext) -> Optional[float]:
    measured = ctx.health.latency_ms(spec.id)
    if measured is not None:
        return measured
    return _PROFILE_MS.get(spec.latency_profile or "")


def _unit_cost(spec: ModelSpec) -> Optional[float]:
    if spec.input_cost_per_mtok is None or spec.output_cost_per_mtok is None:
        return None
    return spec.input_cost_per_mtok + spec.output_cost_per_mtok


class PriorityStrategy(Strategy):
    name = "priority"

    def order(self, specs, ctx):
        return list(specs)


class CostStrategy(Strategy):
    name = "cost"

    def order(self, specs, ctx):
        def key(spec: ModelSpec):
            cost = _unit_cost(spec)
            return (cost is None, cost or 0.0)

        return sorted(specs, key=key)


class LatencyStrategy(Strategy):
    name = "latency"

    def order(self, specs, ctx):
        def key(spec: ModelSpec):
            latency = _expected_latency(spec, ctx)
            return (latency is None, latency or 0.0)

        return sorted(specs, key=key)


class LoadStrategy(Strategy):
    name = "load"

    def order(self, specs, ctx):
        return sorted(specs, key=lambda spec: ctx.inflight.count(spec.id))


def _normalize(values: Sequence[Optional[float]]) -> List[float]:
    """Scales to 0..1 (0 = best/lowest). A value we do not know scores a neutral
    0.5, so a missing price or latency neither rewards nor punishes a model."""
    known = [v for v in values if v is not None]
    if not known:
        return [0.5] * len(values)
    lo, hi = min(known), max(known)
    span = hi - lo
    out: List[float] = []
    for v in values:
        if v is None:
            out.append(0.5)
        elif span == 0:
            out.append(0.0)
        else:
            out.append((v - lo) / span)
    return out


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
