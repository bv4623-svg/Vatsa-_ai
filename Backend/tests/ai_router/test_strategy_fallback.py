import pytest

from app.ai_router.errors import NoEligibleModel
from app.ai_router.fallback import plan_candidates
from app.ai_router.health import HealthTracker
from app.ai_router.circuit_breaker import BreakerBoard
from app.ai_router.load_balancer import InFlightTracker
from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.strategy import (
    CostStrategy, HybridStrategy, LatencyStrategy, LoadStrategy, PriorityStrategy,
    StrategyContext, build_strategy, parse_weights,
)
from app.ai_router.types import Capability, ModelSpec, RouteRequest

CHAT = frozenset({Capability.CHAT})
CHAT_VISION = frozenset({Capability.CHAT, Capability.VISION})


def _ctx():
    board = BreakerBoard()
    return StrategyContext(HealthTracker(board), InFlightTracker())


def _registry():
    models = [
        ModelSpec("cheap", "p", "p/cheap", CHAT, input_cost_per_mtok=1, output_cost_per_mtok=1, priority=50, latency_profile="fast"),
        ModelSpec("mid", "p", "p/mid", CHAT, input_cost_per_mtok=5, output_cost_per_mtok=5, priority=30, latency_profile="medium"),
        ModelSpec("pricey", "p", "p/pricey", CHAT, input_cost_per_mtok=20, output_cost_per_mtok=20, priority=10, latency_profile="slow"),
        ModelSpec("vision-only", "p", "p/vision", CHAT_VISION, priority=5),
    ]
    routes = {
        "auto": RouteDef("pricey", ("mid", "cheap"), pinned=True),
        "vision": RouteDef("vision-only", ()),
    }
    return ModelRegistry(models, routes, "auto")


def test_priority_strategy_keeps_declared_order():
    reg = _registry()
    plan = reg.resolve("auto")
    ordered = PriorityStrategy().order(plan.candidates(), _ctx())
    assert [m.id for m in ordered] == ["pricey", "mid", "cheap"]


def test_cost_strategy_orders_cheapest_first():
    reg = _registry()
    plan = reg.resolve("auto")
    ordered = CostStrategy().order(plan.candidates(), _ctx())
    assert [m.id for m in ordered] == ["cheap", "mid", "pricey"]


def test_latency_strategy_uses_profile_when_unmeasured():
    reg = _registry()
    plan = reg.resolve("auto")
    ordered = LatencyStrategy().order(plan.candidates(), _ctx())
    assert [m.id for m in ordered] == ["cheap", "mid", "pricey"]  # fast < medium < slow


def test_load_strategy_prefers_fewer_inflight_calls():
    reg = _registry()
    plan = reg.resolve("auto")
    ctx = _ctx()
    ctx.inflight.begin("pricey")
    ordered = LoadStrategy().order(plan.candidates(), ctx)
    assert ordered[0].id != "pricey"


def test_hybrid_strategy_is_deterministic_given_ties():
    reg = _registry()
    plan = reg.resolve("auto")
    ctx = _ctx()
    strat = HybridStrategy()
    o1 = [m.id for m in strat.order(plan.candidates(), ctx)]
    o2 = [m.id for m in strat.order(plan.candidates(), ctx)]
    assert o1 == o2


def test_parse_weights_ignores_unknown_and_negative_entries():
    weights = parse_weights("cost=0.5,latency=-1,bogus=9,load=0.25")
    assert weights == {"cost": 0.5, "load": 0.25}


def test_build_strategy_unknown_name_falls_back_to_priority():
    strat = build_strategy("not-a-real-strategy")
    assert strat.name == "priority"


def test_plan_candidates_pinned_route_keeps_primary_first_under_cost():
    reg = _registry()
    ctx = _ctx()
    req = RouteRequest(messages=[], route="auto", required=CHAT)
    strat = CostStrategy()
    ordered = plan_candidates(reg, req, strat, ctx)
    assert ordered[0].id == "pricey"  # pinned primary stays first even though it's the most expensive
    assert [m.id for m in ordered[1:]] == ["cheap", "mid"]  # the tail is cost-ordered


def test_plan_candidates_filters_by_capability_and_falls_back_to_vision_route():
    reg = _registry()
    ctx = _ctx()
    req = RouteRequest(messages=[], route="auto", required=CHAT_VISION)
    ordered = plan_candidates(reg, req, PriorityStrategy(), ctx)
    assert [m.id for m in ordered] == ["vision-only"]


def test_plan_candidates_raises_when_nothing_is_eligible():
    models = [ModelSpec("chat-only", "p", "p/m", CHAT)]
    reg = ModelRegistry(models, {"auto": RouteDef("chat-only")}, "auto")
    ctx = _ctx()
    req = RouteRequest(messages=[], route="auto", required=CHAT_VISION)
    with pytest.raises(NoEligibleModel):
        plan_candidates(reg, req, PriorityStrategy(), ctx)


def test_plan_candidates_disabled_model_is_excluded():
    models = [
        ModelSpec("primary", "p", "p/a", CHAT, enabled=False),
        ModelSpec("backup", "p", "p/b", CHAT),
    ]
    reg = ModelRegistry(models, {"auto": RouteDef("primary", ("backup",), pinned=False)}, "auto")
    ctx = _ctx()
    req = RouteRequest(messages=[], route="auto", required=CHAT)
    ordered = plan_candidates(reg, req, PriorityStrategy(), ctx)
    assert [m.id for m in ordered] == ["backup"]


def test_plan_candidates_fallback_disabled_keeps_one_model():
    reg = _registry()
    ctx = _ctx()
    req = RouteRequest(messages=[], route="auto", required=CHAT, allow_fallback=True)
    ordered = plan_candidates(reg, req, PriorityStrategy(), ctx, fallback_enabled=False)
    assert len(ordered) == 1
    assert ordered[0].id == "pricey"

    req2 = RouteRequest(messages=[], route="auto", required=CHAT, allow_fallback=False)
    ordered2 = plan_candidates(reg, req2, PriorityStrategy(), ctx)
    assert len(ordered2) == 1
