"""The single-signal strategies: priority (declared order), cost, latency,
load. See app.ai_router.strategy (package docstring) for what each means."""
from __future__ import annotations

from app.ai_router.strategy.base import Strategy, _expected_latency, _unit_cost


class PriorityStrategy(Strategy):
    name = "priority"

    def order(self, specs, ctx):
        return list(specs)


class CostStrategy(Strategy):
    name = "cost"

    def order(self, specs, ctx):
        def key(spec):
            cost = _unit_cost(spec)
            return (cost is None, cost or 0.0)

        return sorted(specs, key=key)


class LatencyStrategy(Strategy):
    name = "latency"

    def order(self, specs, ctx):
        def key(spec):
            latency = _expected_latency(spec, ctx)
            return (latency is None, latency or 0.0)

        return sorted(specs, key=key)


class LoadStrategy(Strategy):
    name = "load"

    def order(self, specs, ctx):
        return sorted(specs, key=lambda spec: ctx.inflight.count(spec.id))
