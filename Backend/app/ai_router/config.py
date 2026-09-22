"""Router configuration: tunables from the environment, and the model registry
(built in, or replaced wholesale by a JSON file named in AI_ROUTER_CONFIG_PATH).

Environment variables (all optional):

  AI_DEFAULT_ROUTE              public route used for unknown/missing names      (auto)
  AI_FALLBACK_ENABLED           false = never try a second model                  (true)
  AI_MAX_RETRIES                retries per model before falling back             (1)
  AI_TIMEOUT_MS                 per-attempt timeout / stream gap timeout          (30000)
  AI_TOTAL_TIMEOUT_MS           deadline for one whole request, retries and
                                fallbacks included (before output starts)         (90000)
  AI_ROUTER_STRATEGY            priority | cost | latency | load | hybrid          (priority)
  AI_ROUTER_WEIGHTS             hybrid weights, e.g. cost=0.5,latency=0.2          (built-in)
  AI_BREAKER_FAILURES           consecutive failures that open a circuit          (5)
  AI_BREAKER_COOLDOWN_S         seconds a circuit stays open                      (30)
  AI_BREAKER_HALF_OPEN_CALLS    probe calls allowed while half-open               (1)
  AI_PROVIDER_HEALTH_CHECK      allow active provider health checks               (true)
  AI_MAX_INFLIGHT               concurrent AI calls per process before shedding   (256)
  AI_ROUTER_CONFIG_PATH         JSON file that replaces the built-in registry
  REASONING_MODEL / VISION_MODEL  provider model ids for those two routes
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional

from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.types import Capability, ModelSpec

logger = logging.getLogger("AIRouter.config")

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _bool(env: Mapping[str, str], name: str, default: bool) -> bool:
    raw = (env.get(name) or "").strip().lower()
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    if raw:
        logger.warning("Ignoring %s=%r (expected true/false); using %s", name, raw, default)
    return default


def _number(env: Mapping[str, str], name: str, default: float, minimum: float, cast=float):
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = cast(raw)
    except ValueError:
        logger.warning("Ignoring %s=%r (not a number); using %s", name, raw, default)
        return default
    if value < minimum:
        logger.warning("Ignoring %s=%r (below %s); using %s", name, raw, minimum, default)
        return default
    return value


@dataclass(frozen=True)
class RouterConfig:
    default_route: str = "auto"
    fallback_enabled: bool = True
    max_retries: int = 1
    timeout_s: float = 30.0
    total_timeout_s: float = 90.0
    strategy: str = "priority"
    strategy_weights: Optional[str] = None
    breaker_failure_threshold: int = 5
    breaker_cooldown_s: float = 30.0
    breaker_half_open_max_calls: int = 1
    health_check_enabled: bool = True
    max_inflight: int = 256
    retry_base_delay_s: float = 0.25
    retry_max_delay_s: float = 2.0
    retry_max_retry_after_s: float = 5.0
    config_path: Optional[str] = None

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "RouterConfig":
        env = os.environ if env is None else env
        return cls(
            default_route=(env.get("AI_DEFAULT_ROUTE") or "auto").strip().lower(),
            fallback_enabled=_bool(env, "AI_FALLBACK_ENABLED", True),
            max_retries=_number(env, "AI_MAX_RETRIES", 1, 0, int),
            timeout_s=_number(env, "AI_TIMEOUT_MS", 30000, 100) / 1000.0,
            total_timeout_s=_number(env, "AI_TOTAL_TIMEOUT_MS", 90000, 100) / 1000.0,
            strategy=(env.get("AI_ROUTER_STRATEGY") or "priority").strip().lower(),
            strategy_weights=(env.get("AI_ROUTER_WEIGHTS") or "").strip() or None,
            breaker_failure_threshold=_number(env, "AI_BREAKER_FAILURES", 5, 1, int),
            breaker_cooldown_s=_number(env, "AI_BREAKER_COOLDOWN_S", 30, 0),
            breaker_half_open_max_calls=_number(env, "AI_BREAKER_HALF_OPEN_CALLS", 1, 1, int),
            health_check_enabled=_bool(env, "AI_PROVIDER_HEALTH_CHECK", True),
            max_inflight=_number(env, "AI_MAX_INFLIGHT", 256, 1, int),
            config_path=(env.get("AI_ROUTER_CONFIG_PATH") or "").strip() or None,
        )


# ---------------------------------------------------------------- registry data

_CHAT_CODE = frozenset({Capability.CHAT, Capability.CODE})
_CHAT_CODE_VISION = frozenset({Capability.CHAT, Capability.CODE, Capability.VISION})


def builtin_registry(env: Optional[Mapping[str, str]] = None, default_route: str = "auto") -> ModelRegistry:
    """The registry that reproduces the routing this backend had before the
    router existed: same models, same fallback order, same premium rule.

    Cost fields are left empty on purpose. Enter real prices (in a config file
    or here) before relying on cost-based routing.
    """
    env = os.environ if env is None else env
    reasoning_model = (env.get("REASONING_MODEL") or "deepseek/deepseek-r1").strip()
    vision_model = (env.get("VISION_MODEL") or "openai/gpt-4o").strip()

    models = [
        ModelSpec("gpt-4o", "openrouter", "openai/gpt-4o", _CHAT_CODE_VISION, priority=10, premium=True),
        ModelSpec("sonnet", "openrouter", "anthropic/claude-3.5-sonnet", _CHAT_CODE_VISION, priority=20, premium=True),
        ModelSpec("gemini-pro", "openrouter", "google/gemini-2.5-pro", _CHAT_CODE_VISION, priority=30, premium=True),
        ModelSpec("free-nex", "openrouter", "nex-agi/nex-n2.5-mini:free", _CHAT_CODE, priority=50, premium=False),
        ModelSpec("free-nemotron", "openrouter", "nvidia/nemotron-3.5-lightning:free", _CHAT_CODE, priority=51, premium=False),
        ModelSpec("free-gemma", "openrouter", "google/gemma-4-31b-it:free", _CHAT_CODE, priority=52, premium=False),
        ModelSpec("deepseek-chat", "openrouter", "deepseek/deepseek-chat", _CHAT_CODE, priority=90, premium=False),
        ModelSpec("reasoning", "openrouter", reasoning_model,
                  frozenset({Capability.CHAT, Capability.REASONING})),
    ]
    by_model = {m.model: m.id for m in models}

    vision_primary = by_model.get(vision_model)
    if vision_primary is None:
        models.append(ModelSpec("vision-custom", "openrouter", vision_model, _CHAT_CODE_VISION))
        vision_primary = "vision-custom"

    # Previous behaviour: the requested model, then this fixed chain.
    fallback_chain = ("free-nex", "free-nemotron", "free-gemma", "deepseek-chat")

    def chat_route(primary: str) -> RouteDef:
        return RouteDef(primary, tuple(f for f in fallback_chain if f != primary))

    routes: Dict[str, RouteDef] = {
        "auto": chat_route("gpt-4o"),
        "vatsa-pro": chat_route("gpt-4o"),
        "vatsa-advanced": chat_route("sonnet"),
        "vatsa-fast": chat_route("gemini-pro"),
        # Names older client builds may still send. Kept so saved preferences keep working.
        "claude-opus-5": chat_route("sonnet"),
        "claude-3.5-sonnet": chat_route("sonnet"),
        "gpt-5.6-luna": chat_route("gpt-4o"),
        "gpt-4o": chat_route("gpt-4o"),
        "gemini-3.6-flash": chat_route("gemini-pro"),
        "gemini-1.5-pro": chat_route("gemini-pro"),
        "deepseek-v3.2": chat_route("deepseek-chat"),
        "deepseek-chat": chat_route("deepseek-chat"),
        # Internal routes chosen by the application, not by the client.
        # Reasoning never falls back: a plain answer would look like the reasoning the user asked for.
        "reasoning": RouteDef("reasoning", allow_fallback=False),
        # Vision may now fall back to another vision-capable model (it had no fallback before).
        "vision": RouteDef(vision_primary, tuple(i for i in ("gpt-4o", "sonnet", "gemini-pro") if i != vision_primary)),
    }
    return ModelRegistry(models, routes, default_route)


# ---------------------------------------------------------------- JSON file form

def registry_from_dict(data: Mapping[str, Any], default_route: str = "auto") -> ModelRegistry:
    """Builds a registry from the JSON shape documented in ai_router.example.json.
    Raises ValueError with a specific message when the file is wrong, so a bad
    config fails at startup instead of at the first user request."""
    try:
        models = []
        for m in data["models"]:
            models.append(ModelSpec(
                id=m["id"],
                provider=m["provider"],
                model=m["model"],
                capabilities=frozenset(Capability(c) for c in m.get("capabilities", ["chat"])),
                context_window=m.get("context_window"),
                max_output=m.get("max_output"),
                input_cost_per_mtok=m.get("input_cost_per_mtok"),
                output_cost_per_mtok=m.get("output_cost_per_mtok"),
                latency_profile=m.get("latency_profile"),
                priority=int(m.get("priority", 100)),
                premium=m.get("premium"),
                enabled=bool(m.get("enabled", True)),
            ))
        routes = {
            name: RouteDef(
                primary=r["primary"],
                fallbacks=tuple(r.get("fallbacks", ())),
                allow_fallback=bool(r.get("allow_fallback", True)),
                pinned=bool(r.get("pinned", True)),
            )
            for name, r in data["routes"].items()
        }
        return ModelRegistry(models, routes, data.get("default_route", default_route))
    except KeyError as exc:
        raise ValueError(f"router config is missing required field {exc}") from None
    except (TypeError, AttributeError) as exc:
        raise ValueError(f"router config has the wrong shape: {exc}") from None


def load_registry(config: RouterConfig, env: Optional[Mapping[str, str]] = None) -> ModelRegistry:
    if config.config_path:
        with open(config.config_path, encoding="utf-8") as fh:
            return registry_from_dict(json.load(fh), config.default_route)
    return builtin_registry(env, config.default_route)
