"""Shared fakes for the model provider. Imported by tests; never by app code.

The fake sits under the real AI router (app/ai_router): chat, vision, deep
research and the review summary all run their real code paths, including the
router's fallback and error sanitizing -- only the network call is faked.
"""
import json

import pytest

from app.ai_router import reset_router, set_router
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.errors import ErrorKind, ProviderError
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.types import EventType, StreamEvent, Usage


def sse_events(text: str):
    return [json.loads(line[5:]) for line in text.splitlines() if line.startswith("data:")]


def registry():
    """The router's built-in registry: the same models and fallback order the
    backend used before the router existed."""
    return builtin_registry({}, "auto")


class _ScriptedAdapter(ProviderAdapter):
    name = "openrouter"

    def __init__(self, state):
        self.state = state

    def _outcome(self, model, messages):
        self.state["calls"].append(model)
        self.state["messages"].append(messages)
        outcome = self.state["script"].get(model, self.state["default"])
        if isinstance(outcome, ProviderError):
            raise outcome
        if isinstance(outcome, Exception):
            # The real OpenRouter adapter turns every failure into a
            # ProviderError whose provider text stays in .detail (server logs).
            raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=str(outcome))
        return outcome

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        outcome = self._outcome(model, messages)
        return ProviderResult(content=outcome, usage=Usage(10, 5))

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        outcome = self._outcome(model, messages)
        half = len(outcome) // 2
        yield StreamEvent(EventType.DELTA, content=outcome[:half])
        yield StreamEvent(EventType.DELTA, content=outcome[half:])
        yield StreamEvent(EventType.USAGE, usage=Usage(10, 5))

    async def health_check(self, timeout_s=5.0):
        return True


@pytest.fixture()
def fake_llm():
    """Installs a router whose only provider is scripted. `script` maps a
    provider model id (e.g. registry().resolve("auto").primary.model) to a
    reply string or an Exception; anything unscripted gets `default`.
    `calls` records the model ids tried, in order; `messages` what each got."""
    state = {"script": {}, "default": "Hello there.", "calls": [], "messages": []}
    config = RouterConfig.from_env({"AI_MAX_RETRIES": "0", "AI_BREAKER_FAILURES": "99"})
    set_router(RouterEngine(registry(), {"openrouter": _ScriptedAdapter(state)}, config))
    try:
        yield state
    finally:
        reset_router()
