"""Regression tests for two more leaks found while building the AI Router:

1. A raw provider exception message (e.g. "OpenRouter [500]: ...") used to
   reach the client verbatim in the streaming {"error": ...} event and in
   the exception raised by generate_response -- which the scheduled-task
   runner (app/services/scheduled_tasks/runner.py) then emails to the user
   as `error_text = str(e)`. Routing everything through the Router Engine
   fixes both at once: every exception AIService can now raise is a
   RouterError, and RouterError.__str__() is guaranteed to be the fixed
   public message (see app/ai_router/errors.py).

These tests install a fake, always-failing adapter via app.ai_router's
test-only set_router()/reset_router() hooks -- no real network call.
"""
import asyncio

import pytest

from app.ai_router import reset_router, set_router
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.errors import ErrorKind, ProviderError, RouterError
from app.ai_router.providers.base import ProviderAdapter
from app.services.ai_service import AIService

SENSITIVE_DETAIL = "Anthropic API error: model claude-3.5-sonnet rejected key sk-ant-secret-abc123"
LEAK_TERMS = ("anthropic", "claude", "sonnet", "sk-ant", "openrouter", "openai")


class AlwaysFailsAdapter(ProviderAdapter):
    name = "openrouter"

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=SENSITIVE_DETAIL)

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=SENSITIVE_DETAIL)
        yield  # pragma: no cover - makes this an async generator

    async def health_check(self, timeout_s=5.0):
        return False


@pytest.fixture()
def failing_router():
    config = RouterConfig.from_env({"AI_MAX_RETRIES": "0", "AI_BREAKER_FAILURES": "99"})
    registry = builtin_registry({}, "auto")
    engine = RouterEngine(registry, {"openrouter": AlwaysFailsAdapter()}, config)
    set_router(engine)
    try:
        yield engine
    finally:
        reset_router()


def _assert_no_leak(text: str) -> None:
    lowered = text.lower()
    for term in LEAK_TERMS:
        assert term not in lowered, f"leaked {term!r} in: {text!r}"
    assert "sk-ant" not in text


def test_generate_response_raises_router_error_with_safe_message(db, make_user, failing_router):
    user, _ = make_user(tier="free")

    async def run():
        with pytest.raises(RouterError) as exc_info:
            await AIService.generate_response(
                db=db, user=user, query="hello", conversation_history=[], model_name="auto",
            )
        return exc_info.value

    err = asyncio.run(run())
    _assert_no_leak(str(err))
    _assert_no_leak(err.public_message)


def test_stream_response_error_event_has_no_provider_text(db, make_user, failing_router):
    user, _ = make_user(tier="free")

    async def run():
        events = []
        async for event in AIService.stream_response(
            db=db, user=user, query="hello", conversation_history=[], model_name="auto",
        ):
            events.append(event)
        return events

    events = asyncio.run(run())
    assert not any("delta" in e or "thinking" in e for e in events)
    error_events = [e for e in events if "error" in e]
    assert len(error_events) == 1
    _assert_no_leak(error_events[0]["error"])


def test_scheduled_task_runner_would_only_ever_see_the_safe_message(db, make_user, failing_router):
    """runner.py does `error_text = str(e)` and emails it verbatim -- so the
    fix is exactly that str(e) is safe for any exception generate_response
    can raise. This asserts that contract directly rather than standing up
    the full scheduler/email pipeline."""
    user, _ = make_user(tier="free")

    async def run():
        try:
            await AIService.generate_response(
                db=db, user=user, query="hello", conversation_history=[], model_name="auto",
            )
        except Exception as e:
            return str(e)
        return None

    error_text = asyncio.run(run())
    assert error_text is not None
    _assert_no_leak(error_text)
