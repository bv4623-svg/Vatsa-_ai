"""Engine-level tests against fake adapters (no real network calls). Async
tests are driven with asyncio.run() rather than pytest-asyncio, which isn't
part of this project's dependencies."""
import asyncio

import pytest

from app.ai_router.circuit_breaker import BreakerState
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.errors import AllProvidersFailed, ErrorKind, ProviderError, RouterOverloaded
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.registry import ModelRegistry, RouteDef
from app.ai_router.types import Capability, EventType, RouteRequest, StreamEvent, Usage

CHAT = frozenset({Capability.CHAT})


class FakeAdapter(ProviderAdapter):
    name = "openrouter"

    def __init__(self):
        self.fail_models = set()
        self.calls = []
        self.hang = False

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        if self.hang:
            await asyncio.sleep(timeout_s + 5)
        if model in self.fail_models:
            raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=f"{model} is down")
        return ProviderResult(content=f"reply from claude sonnet {model}", usage=Usage(10, 5))

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        if model in self.fail_models:
            raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=f"{model} is down")
        yield StreamEvent(EventType.DELTA, content="hi ")
        yield StreamEvent(EventType.DELTA, content="there")
        yield StreamEvent(EventType.USAGE, usage=Usage(3, 2))

    async def health_check(self, timeout_s=5.0):
        return True


def _engine(adapter, **cfg_overrides):
    env = {"AI_BREAKER_FAILURES": "2", "AI_MAX_RETRIES": "1", **cfg_overrides}
    config = RouterConfig.from_env(env)
    registry = builtin_registry({}, "auto")
    return RouterEngine(registry, {"openrouter": adapter}, config), config


def _msgs():
    return [{"role": "user", "content": "hi"}]


def test_generate_success_and_sanitizes_content():
    adapter = FakeAdapter()
    engine, _ = _engine(adapter)
    result = asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="auto")))
    assert "[redacted]" in result.content
    assert "claude" not in result.content.lower()
    assert "sonnet" not in result.content.lower()
    assert result.meta.provider == "openrouter"
    assert result.usage.total_tokens == 15


def test_generate_falls_back_when_primary_fails():
    adapter = FakeAdapter()
    adapter.fail_models = {"openai/gpt-4o"}
    engine, _ = _engine(adapter)
    result = asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="auto")))
    assert result.meta.model != "gpt-4o"
    assert result.meta.fallbacks >= 1


def test_generate_raises_all_providers_failed_and_opens_breakers():
    adapter = FakeAdapter()
    adapter.fail_models = {
        "openai/gpt-4o", "nex-agi/nex-n2.5-mini:free", "nvidia/nemotron-3.5-lightning:free",
        "google/gemma-4-31b-it:free", "deepseek/deepseek-chat",
    }
    engine, _ = _engine(adapter)
    with pytest.raises(AllProvidersFailed) as exc_info:
        asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="auto")))
    assert "gpt-4o" not in str(exc_info.value)
    assert engine.breaker_states()["gpt-4o"] == BreakerState.OPEN.value


def test_reasoning_route_never_falls_back_on_failure():
    adapter = FakeAdapter()
    reg = builtin_registry({}, "auto")
    reasoning_model = reg.resolve("reasoning").primary.model
    adapter.fail_models = {reasoning_model}
    engine, _ = _engine(adapter)
    with pytest.raises(AllProvidersFailed):
        asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="reasoning", allow_fallback=False)))
    assert adapter.calls.count(reasoning_model) >= 1
    assert all(c == reasoning_model for c in adapter.calls)  # never tried a different model


def test_stream_success_yields_deltas_then_done():
    adapter = FakeAdapter()
    engine, _ = _engine(adapter)

    async def run():
        events = []
        async for evt in engine.stream(RouteRequest(messages=_msgs(), route="vatsa-fast")):
            events.append(evt)
        return events

    events = asyncio.run(run())
    deltas = "".join(e.content for e in events if e.type == EventType.DELTA)
    assert deltas == "hi there"
    done = [e for e in events if e.type == EventType.DONE][0]
    assert done.truncated is False
    assert done.meta is not None


def test_stream_raises_all_providers_failed_when_every_model_fails():
    adapter = FakeAdapter()
    reg = builtin_registry({}, "auto")
    plan = reg.resolve("vatsa-fast")
    adapter.fail_models = {m.model for m in plan.candidates()}
    engine, _ = _engine(adapter)

    async def run():
        events = []
        async for evt in engine.stream(RouteRequest(messages=_msgs(), route="vatsa-fast")):
            events.append(evt)
        return events

    with pytest.raises(AllProvidersFailed):
        asyncio.run(run())


def test_admission_control_rejects_over_capacity_requests():
    adapter = FakeAdapter()
    engine, _ = _engine(adapter, AI_MAX_INFLIGHT="1")
    engine._admission.try_acquire(1)  # simulate one call already in flight
    with pytest.raises(RouterOverloaded):
        asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="auto")))


def test_bad_request_errors_do_not_open_the_circuit():
    class BadRequestAdapter(FakeAdapter):
        async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
            self.calls.append(model)
            raise ProviderError(ErrorKind.BAD_REQUEST, status=400, detail="malformed request")

    adapter = BadRequestAdapter()
    reg = builtin_registry({}, "auto")
    config = RouterConfig.from_env({"AI_BREAKER_FAILURES": "1", "AI_MAX_RETRIES": "0"})
    engine = RouterEngine(reg, {"openrouter": adapter}, config)
    with pytest.raises(AllProvidersFailed):
        asyncio.run(engine.generate(RouteRequest(messages=_msgs(), route="reasoning", allow_fallback=False)))
    # BAD_REQUEST is not health-affecting: the breaker must still be closed
    assert engine.breaker_states().get("reasoning", "closed") == "closed"


def test_vision_capability_filters_to_vision_capable_models():
    adapter = FakeAdapter()
    engine, _ = _engine(adapter)
    result = asyncio.run(engine.generate(RouteRequest(
        messages=[{"role": "user", "content": [
            {"type": "text", "text": "describe"},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,xx"}},
        ]}],
        route="auto",
        required=frozenset({Capability.CHAT, Capability.VISION}),
    )))
    used = engine.registry.get(result.meta.model)
    assert Capability.VISION in used.capabilities
