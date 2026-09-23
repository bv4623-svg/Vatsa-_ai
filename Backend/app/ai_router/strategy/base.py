"""Shared strategy scaffolding: the Strategy interface, StrategyContext, and
the small helpers every concrete strategy in simple.py/hybrid.py uses to
read a model's expected latency/cost."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Sequence

from app.ai_router.health import HealthTracker
from app.ai_router.load_balancer import InFlightTracker
from app.ai_router.types import ModelSpec

logger = logging.getLogger("AIRouter.strategy")

# Used only until a model has measured latency.
_PROFILE_MS = {"fast": 500.0, "medium": 2000.0, "slow": 8000.0}


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
