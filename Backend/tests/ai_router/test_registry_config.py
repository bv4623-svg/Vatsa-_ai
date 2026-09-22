import pytest

from app.ai_router.config import RouterConfig, builtin_registry, registry_from_dict
from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.types import Capability, ModelSpec


def test_builtin_registry_has_expected_routes_and_no_dangling_refs():
    reg = builtin_registry({}, "auto")
    for name in ("auto", "vatsa-pro", "vatsa-advanced", "vatsa-fast", "reasoning", "vision"):
        assert name in reg.route_names()
    # every route resolves without raising (validates fallbacks reference real models)
    for name in reg.route_names():
        plan = reg.resolve(name)
        assert plan.primary in plan.candidates()


def test_unknown_alias_falls_back_to_default_route():
    reg = builtin_registry({}, "auto")
    assert reg.canonical_route("some-model-a-client-invented") == "auto"
    assert reg.canonical_route(None) == "auto"
    assert reg.canonical_route("  ") == "auto"
    # and resolve() never raises for an unknown alias -- no arbitrary passthrough
    plan = reg.resolve("openai/gpt-4o-mini-please-give-me-this-exact-model")
    assert plan.route == "auto"


def test_reasoning_route_never_falls_back():
    reg = builtin_registry({}, "auto")
    plan = reg.resolve("reasoning")
    assert plan.allow_fallback is False
    assert plan.fallbacks == ()


def test_duplicate_model_id_rejected():
    dup = ModelSpec("dup", "p", "p/m", frozenset({Capability.CHAT}))
    with pytest.raises(ValueError):
        ModelRegistry([dup, dup], {"auto": RouteDef("dup")}, "auto")


def test_route_referencing_unknown_model_rejected():
    m = ModelSpec("only", "p", "p/m", frozenset({Capability.CHAT}))
    with pytest.raises(ValueError):
        ModelRegistry([m], {"auto": RouteDef("ghost")}, "auto")


def test_unknown_default_route_rejected():
    m = ModelSpec("only", "p", "p/m", frozenset({Capability.CHAT}))
    with pytest.raises(ValueError):
        ModelRegistry([m], {"auto": RouteDef("only")}, "missing")


def test_is_premium_explicit_flag_wins_over_legacy_marker():
    premium_by_name = ModelSpec("x", "p", "sonnet-lookalike", frozenset({Capability.CHAT}), premium=False)
    assert ModelRegistry.is_premium(premium_by_name) is False  # explicit False overrides the "sonnet" substring

    legacy = ModelSpec("y", "p", "some/claude-model", frozenset({Capability.CHAT}))  # premium=None
    assert ModelRegistry.is_premium(legacy) is True


def test_internal_terms_covers_ids_models_and_providers():
    reg = builtin_registry({}, "auto")
    terms = reg.internal_terms()
    assert "openrouter" in terms
    assert "gpt-4o" in terms  # registry id
    assert any("openai/gpt-4o" == t for t in terms)  # provider model string


def test_registry_from_dict_missing_field_raises_value_error():
    with pytest.raises(ValueError):
        registry_from_dict({"models": []})  # no "routes" key


def test_registry_from_dict_round_trip():
    data = {
        "default_route": "auto",
        "models": [
            {"id": "a", "provider": "openrouter", "model": "vendor/a", "capabilities": ["chat"]},
            {"id": "b", "provider": "openrouter", "model": "vendor/b", "capabilities": ["chat"],
             "input_cost_per_mtok": 1.5, "output_cost_per_mtok": 3.0, "premium": True},
        ],
        "routes": {"auto": {"primary": "a", "fallbacks": ["b"]}},
    }
    reg = registry_from_dict(data)
    assert reg.get("b").input_cost_per_mtok == 1.5
    assert reg.is_premium(reg.get("b")) is True


def test_from_env_ignores_bad_values_and_uses_defaults():
    cfg = RouterConfig.from_env({
        "AI_MAX_RETRIES": "not-a-number",
        "AI_FALLBACK_ENABLED": "sideways",
        "AI_TIMEOUT_MS": "-5",
    })
    defaults = RouterConfig()
    assert cfg.max_retries == defaults.max_retries
    assert cfg.fallback_enabled == defaults.fallback_enabled
    assert cfg.timeout_s == defaults.timeout_s


def test_from_env_reads_valid_values():
    cfg = RouterConfig.from_env({
        "AI_DEFAULT_ROUTE": "VATSA-PRO",
        "AI_FALLBACK_ENABLED": "false",
        "AI_MAX_RETRIES": "3",
        "AI_TIMEOUT_MS": "5000",
        "AI_ROUTER_STRATEGY": "COST",
        "AI_MAX_INFLIGHT": "10",
    })
    assert cfg.default_route == "vatsa-pro"
    assert cfg.fallback_enabled is False
    assert cfg.max_retries == 3
    assert cfg.timeout_s == 5.0
    assert cfg.strategy == "cost"
    assert cfg.max_inflight == 10
