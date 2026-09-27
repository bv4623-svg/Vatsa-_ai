"""Image generation: intent detection (shared cases with the frontend),
provider retries/validation, watermark processing, quota, storage, auth on
the served file, and the media-token refresh. The provider is always faked."""
import asyncio
import io
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import pytest
from PIL import Image

from app.services import image_service
from app.services.ai_service import detect_image_gen
from llm_fakes import fake_llm  # noqa: F401  (fixture)

CASES = json.loads((Path(__file__).resolve().parents[2] / "shared" / "image-intent-cases.json").read_text())


def _png(color=(200, 30, 30), size=(64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


# ---- intent -----------------------------------------------------------------

@pytest.mark.parametrize("case", CASES["chat"], ids=lambda c: c["text"][:40] or "<empty>")
def test_image_intent_chat(case):
    assert detect_image_gen(case["text"], "chat") == case["prompt"]


@pytest.mark.parametrize("case", CASES["code_workspace"], ids=lambda c: c["text"][:40])
def test_image_intent_never_fires_in_code_workspace(case):
    assert detect_image_gen(case["text"], "code") == case["prompt"]


def test_image_prompt_is_capped():
    prompt = detect_image_gen("generate an image of " + "a very long scene " * 200)
    assert len(prompt) <= 1000


# ---- provider fetch -----------------------------------------------------------

class _FakeContent:
    def __init__(self, body):
        self._body = body

    async def iter_chunked(self, n):
        for i in range(0, len(self._body), n):
            yield self._body[i:i + n]


class _FakeResp:
    def __init__(self, status, body=b"", ctype="image/png"):
        self.status = status
        self.headers = {"Content-Type": ctype}
        self.content = _FakeContent(body)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _fake_session(responses, seen_urls):
    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, timeout=None):
            seen_urls.append(url)
            r = responses.pop(0)
            if isinstance(r, Exception):
                raise r
            return r
    return _Session


@pytest.fixture()
def no_sleep(monkeypatch):
    async def _instant(_):
        return None
    monkeypatch.setattr(image_service.asyncio, "sleep", _instant)


def test_fetch_retries_transient_failures(monkeypatch, no_sleep):
    seen = []
    responses = [_FakeResp(503), asyncio.TimeoutError(), _FakeResp(200, _png())]
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session(responses, seen))
    raw = asyncio.run(image_service._fetch_raw_image("a fox"))
    assert raw.startswith(b"\x89PNG")
    assert len(seen) == 3
    assert len({u.split("seed=")[1] for u in seen}) == 1, "retries reuse the same seed"


def test_fetch_gives_up_after_max_attempts(monkeypatch, no_sleep):
    responses = [_FakeResp(502), _FakeResp(502), _FakeResp(502)]
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session(responses, []))
    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a fox"))


@pytest.mark.parametrize("resp", [
    _FakeResp(400),
    _FakeResp(200, b"<html>blocked</html>", ctype="text/html"),
    _FakeResp(200, b"", ctype="image/png"),
])
def test_fetch_does_not_retry_permanent_failures(monkeypatch, no_sleep, resp):
    seen = []
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session([resp], seen))
    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a fox"))
    assert len(seen) == 1


def test_fetch_rejects_oversized_image(monkeypatch, no_sleep):
    monkeypatch.setattr(image_service, "MAX_RAW_IMAGE_BYTES", 1000)
    resp = _FakeResp(200, b"\x89PNG" + b"0" * 5000)
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session([resp], []))
    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a fox"))


def test_each_generation_uses_a_new_seed():
    urls = {image_service._provider_url("x", s) for s in (1, 2)}
    assert len(urls) == 2


def test_process_image_trims_and_brands_at_original_size():
    out = image_service._process_image(_png(size=(200, 200)))
    img = Image.open(io.BytesIO(out))
    assert img.format == "PNG" and img.size == (200, 200)


def test_process_image_rejects_garbage():
    with pytest.raises(image_service.ImageProviderError):
        image_service._process_image(b"definitely not an image")


# ---- chat integration -------------------------------------------------------------

@pytest.fixture()
def fake_image_provider(monkeypatch):
    state = {"calls": [], "fail": False}

    async def _fetch(prompt):
        state["calls"].append(prompt)
        if state["fail"]:
            raise image_service.ImageProviderError("Image provider returned status 503")
        return _png()

    monkeypatch.setattr(image_service, "_fetch_raw_image", _fetch)
    return state


def test_image_generation_end_to_end(client, make_user, fake_image_provider, fake_llm):
    _, headers = make_user()
    conv = client.post("/api/conversations", json={"title": "t"}, headers=headers).json()["id"]
    res = client.post("/api/chat", json={"message": "generate an image of a red fox", "conversation_id": conv, "stream": True}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["primary_intent"] == "image_generation"
    assert fake_image_provider["calls"] == ["a red fox"]
    assert fake_llm["calls"] == [], "an image request must not also call the chat model"
    assert "pollinations" not in json.dumps(body).lower()

    # The served file requires the owner's media token.
    parsed = urlparse(body["image_url"])
    path = f"{parsed.path}?{parsed.query}"
    assert client.get(path).status_code == 200
    image_id = path.split("/api/files/")[1].split("/")[0]
    assert client.get(f"/api/files/{image_id}/preview").status_code == 401

    msgs = client.get(f"/api/conversations/{conv}", headers=headers).json()["messages"]
    assert msgs[1]["imageUrl"]


def test_other_user_cannot_view_image(client, make_user, fake_image_provider):
    _, owner = make_user()
    _, other = make_user()
    url = client.post("/api/chat", json={"message": "draw a cat"}, headers=owner).json()["image_url"]
    image_id = url.split("/api/files/")[1].split("/")[0]
    assert client.get(f"/api/files/{image_id}/preview", headers=other).status_code == 404


def test_code_workspace_draw_request_goes_to_the_model(client, make_user, fake_image_provider, fake_llm):
    _, headers = make_user(tier="pro")
    res = client.post("/api/chat", json={"message": "draw a cat using HTML canvas", "workspace": "code"}, headers=headers)
    assert res.status_code == 200
    assert fake_image_provider["calls"] == []
    assert fake_llm["calls"]


def test_attached_image_is_analysed_not_regenerated(client, make_user, fake_image_provider, fake_llm):
    _, headers = make_user()
    att = {"name": "cat.png", "type": "image/png", "is_base64": True,
           "content": "data:image/png;base64," + __import__("base64").b64encode(_png()).decode()}
    client.post("/api/chat", json={"message": "draw a cat like this one", "attachments": [att]}, headers=headers)
    assert fake_image_provider["calls"] == []
    assert fake_llm["calls"]


def test_provider_failure_returns_502_and_keeps_quota(client, make_user, fake_image_provider, db):
    from app.models.usage_daily import UsageDaily
    user, headers = make_user()
    fake_image_provider["fail"] = True
    res = client.post("/api/chat", json={"message": "generate an image of a boat"}, headers=headers)
    assert res.status_code == 502
    assert "temporarily unavailable" in res.json()["detail"]
    assert "503" not in res.text
    row = db.query(UsageDaily).filter_by(user_id=user.id, feature="image_gen").first()
    assert row is None or row.count == 0


def test_image_daily_limit(client, make_user, fake_image_provider, db):
    from app.models.usage_daily import UsageDaily
    user, headers = make_user()
    db.add(UsageDaily(user_id=user.id, feature="image_gen", date=date.today(), count=20))
    db.commit()
    res = client.post("/api/chat", json={"message": "generate an image of a boat"}, headers=headers)
    assert res.status_code == 429
    assert res.json()["detail"]["feature"] == "image_gen"
    assert fake_image_provider["calls"] == []


def test_stored_image_links_are_resigned_on_read(client, make_user, db):
    from app.models.conversation import Conversation
    user, headers = make_user()
    stale = "https://api.example/api/files/" + "a" * 32 + "/preview?token=expired.old.token"
    db.add(Conversation(id="conv_resign01", user_id=user.id, title="t", workspace="chat",
                        messages=[{"role": "assistant", "content": f"![image]({stale})", "imageUrl": stale}]))
    db.commit()
    msg = client.get("/api/conversations/conv_resign01", headers=headers).json()["messages"][0]
    assert "expired.old.token" not in msg["content"] and "expired.old.token" not in msg["imageUrl"]
    fresh = msg["imageUrl"].split("token=")[1]
    assert client.get(f"/api/files/{'a' * 32}/preview?token={fresh}").status_code == 404  # token valid, no such image
