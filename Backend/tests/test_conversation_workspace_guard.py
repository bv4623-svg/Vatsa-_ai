"""POST /api/chat serves both the chat (workspace "chat") and /code
(workspace "code"). A conversation belongs to one of them: sending into a
code project from the chat, or into a chat from /code, is refused before
anything is generated or stored."""
import uuid

import pytest

from app.ai_router import reset_router, set_router
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.types import EventType, StreamEvent, Usage
from app.models.conversation import Conversation


class _Adapter(ProviderAdapter):
    name = "openrouter"

    def __init__(self):
        self.calls = []

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        return ProviderResult(content="An answer.", usage=Usage(5, 5))

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        self.calls.append(model)
        yield StreamEvent(EventType.DELTA, content="An answer.")
        yield StreamEvent(EventType.USAGE, usage=Usage(5, 5))

    async def health_check(self, timeout_s=5.0):
        return True


@pytest.fixture()
def model():
    adapter = _Adapter()
    config = RouterConfig.from_env({"AI_MAX_RETRIES": "0", "AI_BREAKER_FAILURES": "99"})
    set_router(RouterEngine(builtin_registry({}, "auto"), {"openrouter": adapter}, config))
    try:
        yield adapter
    finally:
        reset_router()


def _new(client, headers, workspace):
    res = client.post("/api/conversations", json={"title": workspace, "workspace": workspace}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _messages(db, conv_id):
    db.expire_all()
    return list(db.query(Conversation).filter_by(id=conv_id).one().messages or [])


def test_chat_cannot_write_into_a_code_project(client, db, make_user, model):
    _, headers = make_user("pro")
    project = _new(client, headers, "code")

    res = client.post("/api/chat", json={"message": "hello", "conversation_id": project}, headers=headers)

    assert res.status_code == 400
    assert res.json()["detail"] == "This conversation belongs to Code — open it there."
    assert _messages(db, project) == []
    assert model.calls == [], "refused before the model is called"


def test_code_cannot_write_into_a_chat(client, db, make_user, model):
    _, headers = make_user("pro")
    chat = _new(client, headers, "chat")

    res = client.post("/api/chat", json={"message": "hello", "conversation_id": chat, "workspace": "code"}, headers=headers)

    assert res.status_code == 400
    assert res.json()["detail"] == "This conversation belongs to Chat — open it there."
    assert _messages(db, chat) == []
    assert model.calls == []


def test_each_workspace_still_writes_into_its_own(client, db, make_user, model):
    _, headers = make_user("pro")
    chat = _new(client, headers, "chat")
    project = _new(client, headers, "code")

    assert client.post("/api/chat", json={"message": "hello", "conversation_id": chat}, headers=headers).status_code == 200
    assert client.post("/api/chat", json={"message": "hello", "conversation_id": project, "workspace": "code"}, headers=headers).status_code == 200
    assert len(_messages(db, chat)) == 2
    assert len(_messages(db, project)) == 2


@pytest.mark.parametrize("stored", [None, ""])
def test_rows_saved_without_a_workspace_are_chats(client, db, make_user, model, stored):
    user, headers = make_user("pro")
    conv = Conversation(id=str(uuid.uuid4()), user_id=user.id, title="old chat", messages=[])
    db.add(conv)
    db.commit()
    db.query(Conversation).filter_by(id=conv.id).update({"workspace": stored})
    db.commit()

    from_chat = client.post("/api/chat", json={"message": "hello", "conversation_id": conv.id}, headers=headers)
    from_code = client.post("/api/chat", json={"message": "hello", "conversation_id": conv.id, "workspace": "code"}, headers=headers)

    assert from_chat.status_code == 200
    assert from_code.status_code == 400


def test_an_image_request_into_a_code_project_is_refused_before_generating(client, db, make_user, monkeypatch):
    from app.services import image_service

    calls = []

    async def fetch(prompt):
        calls.append(prompt)
        raise AssertionError("must not be called")
    monkeypatch.setattr(image_service, "_fetch_raw_image", fetch)
    _, headers = make_user("pro")
    project = _new(client, headers, "code")

    res = client.post("/api/chat", json={"message": "generate an image of a red apple", "conversation_id": project}, headers=headers)

    assert res.status_code == 400
    assert calls == []
