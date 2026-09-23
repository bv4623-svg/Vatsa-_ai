"""The built-in registry: reproduces the routing this backend had before
the router existed."""
from __future__ import annotations

import os
from typing import Dict, Mapping, Optional

from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.types import Capability, ModelSpec

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
