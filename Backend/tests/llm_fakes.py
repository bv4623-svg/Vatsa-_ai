"""Shared fakes for the model provider. Imported by tests; never by app code."""
import json

import pytest

from app.services.ai_service import AIService


def sse_events(text: str):
    return [json.loads(line[5:]) for line in text.splitlines() if line.startswith("data:")]


@pytest.fixture()
def fake_llm(monkeypatch):
    """Replaces both OpenRouter transports. `script` controls behaviour per
    model id: a string is streamed as two deltas; an Exception is raised."""
    state = {"script": {}, "default": "Hello there.", "calls": [], "messages": []}

    async def _stream(messages, model, max_tokens=1500, temperature=0.7):
        state["calls"].append(model)
        state["messages"].append(messages)
        outcome = state["script"].get(model, state["default"])
        if isinstance(outcome, Exception):
            raise outcome
        half = len(outcome) // 2
        yield {"type": "delta", "content": outcome[:half]}
        yield {"type": "delta", "content": outcome[half:]}
        yield {"type": "usage", "usage": {"prompt_tokens": 10, "completion_tokens": 5}}

    async def _call(messages, model, max_tokens=1500, temperature=0.7):
        state["calls"].append(model)
        state["messages"].append(messages)
        outcome = state["script"].get(model, state["default"])
        if isinstance(outcome, Exception):
            raise outcome
        return {"content": outcome, "reasoning": "", "model": model,
                "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}

    monkeypatch.setattr(AIService, "stream_openrouter", staticmethod(_stream))
    monkeypatch.setattr(AIService, "call_openrouter", staticmethod(_call))
    return state
