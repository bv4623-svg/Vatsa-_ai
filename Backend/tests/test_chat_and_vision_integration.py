"""End-to-end HTTP tests of the real request path:

    authenticated request -> allowance/daily-limit check -> AI Router Engine
    -> (fake) provider adapter -> sanitized response -> client

No real network call is made -- a fake ProviderAdapter is installed via
app.ai_router's test-only set_router()/reset_router() hooks, exercising the
actual /api/chat, /api/chat/stream and /api/vision/analyze endpoints exactly
as the frontend calls them. This is what proves streaming, token deduction,
cross-user conversation isolation, and provider-failure sanitization all
work together through the real HTTP layer, not just unit-by-unit.
"""
import base64
import json

import pytest

from app.ai_router import reset_router, set_router
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.errors import ErrorKind, ProviderError
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.types import EventType, StreamEvent, Usage
from app.models.token import TokenTransaction


class ScriptedAdapter(ProviderAdapter):
    """A fake OpenRouter adapter. `reply` controls what generate()/stream()
    produce; set `fail` to make every call raise instead."""
    name = "openrouter"

    def __init__(self, reply: str = "Hello from claude sonnet, your assistant."):
        self.reply = reply
        self.fail = False
        self.calls = []

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        if self.fail:
            raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=f"{model} upstream exploded")
        return ProviderResult(content=self.reply, usage=Usage(20, 10))

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        if self.fail:
            raise ProviderError(ErrorKind.SERVER_ERROR, status=500, detail=f"{model} upstream exploded")
        for chunk in self.reply.split(" "):
            yield StreamEvent(EventType.DELTA, content=chunk + " ")
        yield StreamEvent(EventType.USAGE, usage=Usage(15, 8))

    async def health_check(self, timeout_s=5.0):
        return not self.fail


@pytest.fixture()
def fake_router():
    adapter = ScriptedAdapter()
    config = RouterConfig.from_env({"AI_MAX_RETRIES": "0", "AI_BREAKER_FAILURES": "99"})
    registry = builtin_registry({}, "auto")
    engine = RouterEngine(registry, {"openrouter": adapter}, config)
    set_router(engine)
    try:
        yield adapter
    finally:
        reset_router()


def test_chat_non_streaming_end_to_end(client, make_user, db, fake_router):
    user, headers = make_user()
    fake_router.reply = "Sure, here is the answer."

    res = client.post("/api/chat", json={"message": "hello there"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["response"] == "Sure, here is the answer."
    assert body["selected_model"] == "Vatsa AI"  # never a real provider/model name
    assert body["usage"]["total_tokens"] == 30

    # Tokens were actually deducted, recorded against the public name only.
    db.expire_all()  # the request handled this on its own DB session/transaction
    tx = (
        db.query(TokenTransaction)
        .filter_by(user_id=user.id, reason="AI response")
        .order_by(TokenTransaction.id.desc())
        .first()
    )
    assert tx is not None
    assert tx.model == "Vatsa AI"
    assert tx.amount == -30


def test_chat_streaming_end_to_end(client, make_user, fake_router):
    user, headers = make_user()
    fake_router.reply = "streamed answer here"

    res = client.post("/api/chat", json={"message": "hi", "stream": True}, headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    events = [json.loads(line[len("data: "):]) for line in res.text.splitlines() if line.startswith("data: ")]
    deltas = "".join(e["delta"] for e in events if "delta" in e)
    assert deltas.strip() == "streamed answer here"
    done = [e for e in events if e.get("done")]
    assert len(done) == 1
    assert done[0]["usage"]["total_tokens"] > 0


def test_chat_provider_failure_returns_generic_error_never_leaks(client, make_user, fake_router):
    user, headers = make_user()
    fake_router.fail = True

    res = client.post("/api/chat", json={"message": "hi"}, headers=headers)
    assert res.status_code in (502, 503)
    detail = res.json()["detail"]
    for leaked in ("claude", "sonnet", "openrouter", "gpt-4o", "upstream exploded"):
        assert leaked.lower() not in str(detail).lower()


def test_chat_streaming_provider_failure_error_event_is_generic(client, make_user, fake_router):
    user, headers = make_user()
    fake_router.fail = True

    res = client.post("/api/chat", json={"message": "hi", "stream": True}, headers=headers)
    assert res.status_code == 200
    events = [json.loads(line[len("data: "):]) for line in res.text.splitlines() if line.startswith("data: ")]
    assert len(events) == 1 and "error" in events[0]
    assert "openrouter" not in events[0]["error"].lower()


def test_cross_user_conversation_id_in_chat_request_does_not_leak_or_mutate(client, make_user, fake_router):
    owner, owner_headers = make_user()
    attacker, attacker_headers = make_user()

    conv = client.post("/api/conversations", json={"title": "owner chat"}, headers=owner_headers)
    conv_id = conv.json()["id"]
    fake_router.reply = "owner's real answer"
    client.post("/api/chat", json={"message": "secret", "conversation_id": conv_id}, headers=owner_headers)

    # Attacker references the owner's conversation_id in their own request.
    fake_router.reply = "attacker's answer"
    res = client.post("/api/chat", json={"message": "hijack attempt", "conversation_id": conv_id}, headers=attacker_headers)
    assert res.status_code == 200
    assert "secret" not in res.text  # never echoes the owner's prior message back

    # The owner's conversation is untouched by the attacker's request.
    still_owners = client.get(f"/api/conversations/{conv_id}", headers=owner_headers).json()
    contents = [m["content"] for m in still_owners["messages"]]
    assert "hijack attempt" not in contents
    assert "attacker's answer" not in contents
    assert "secret" in contents


def test_vision_analyze_end_to_end(client, make_user, fake_router):
    user, headers = make_user(tier="pro")
    fake_router.reply = json.dumps({
        "description": "a small red square",
        "tags": ["red", "square"],
        "objects": ["square"],
        "extracted_text": "",
    })

    png_1x1 = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    res = client.post(
        "/api/vision/analyze",
        files={"file": ("pixel.png", png_1x1, "image/png")},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description"] == "a small red square"
    assert body["tags"] == ["red", "square"]
    assert "model" not in body and "provider" not in body  # never named in the response


def test_vision_requires_pro_tier(client, make_user, fake_router):
    user, headers = make_user(tier="free")
    png_1x1 = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    res = client.post(
        "/api/vision/analyze",
        files={"file": ("pixel.png", png_1x1, "image/png")},
        headers=headers,
    )
    assert res.status_code == 402  # upgrade_required, from require_feature("vision")
