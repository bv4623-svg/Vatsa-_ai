"""Loading a registry from a JSON file (AI_ROUTER_CONFIG_PATH), and the
top-level load_registry() that picks built-in vs. JSON."""
from __future__ import annotations

import json
from typing import Any, Mapping, Optional

from app.ai_router.config.builtin import builtin_registry
from app.ai_router.config.router_config import RouterConfig
from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.types import Capability, ModelSpec


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
