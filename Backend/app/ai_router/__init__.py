"""Public surface of the AI Router.

Application code should only ever need:

    from app.ai_router import get_router
    from app.ai_router.types import RouteRequest, Capability
    from app.ai_router.errors import RouterError

    router = get_router()
    result = await router.generate(RouteRequest(messages=..., route="auto"))

`get_router()` builds one process-wide RouterEngine on first call (reading
config from the environment) and returns it on every call after that.
`reset_router()` clears it, for tests that need a fresh instance with
different env vars or fake adapters.
"""
from __future__ import annotations

import threading
from typing import Optional

from app.ai_router.config import RouterConfig, load_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.providers import OpenRouterAdapter, ProviderAdapter

__all__ = ["RouterEngine", "get_router", "reset_router", "set_router"]

_lock = threading.Lock()
_router: Optional[RouterEngine] = None


def _build_router() -> RouterEngine:
    config = RouterConfig.from_env()
    registry = load_registry(config)
    adapters = {"openrouter": OpenRouterAdapter()}
    return RouterEngine(registry, adapters, config)


def get_router() -> RouterEngine:
    global _router
    if _router is None:
        with _lock:
            if _router is None:
                _router = _build_router()
    return _router


def set_router(router: RouterEngine) -> None:
    """Installs an explicit engine (fake adapters, fixed config, ...). Tests only."""
    global _router
    with _lock:
        _router = router


def reset_router() -> None:
    """Drops the singleton so the next get_router() rebuilds from the current
    environment. Tests only — call this in a fixture teardown, not from
    application code."""
    global _router
    with _lock:
        _router = None
