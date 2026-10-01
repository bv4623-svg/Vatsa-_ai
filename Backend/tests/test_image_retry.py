"""Image provider calls: retried on transient failures with a fresh seed
each time, never past the request's time budget, validated as an image,
and a failed generation doesn't use up one of the day's images."""
import asyncio
import io

import pytest
from PIL import Image

from app.models.usage_daily import UsageDaily
from app.services import image_service


def _png(size=(64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, format="PNG")
    return buf.getvalue()


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


def _fake_session(responses, seen):
    """seen collects (url, timeout_total) for every attempt."""
    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, timeout=None):
            seen.append((url, timeout.total if timeout else None))
            r = responses.pop(0)
            if isinstance(r, Exception):
                raise r
            return r
    return _Session


@pytest.fixture()
def sleeps(monkeypatch):
    """Waits are recorded and advance a fake clock instead of real time."""
    waited, now = [], [1000.0]

    async def _record(seconds):
        waited.append(seconds)
        now[0] += seconds
    monkeypatch.setattr(image_service.asyncio, "sleep", _record)
    monkeypatch.setattr(image_service, "_clock", lambda: now[0])
    return waited


def _seed(url):
    return url.split("seed=")[1]


def test_two_failures_then_success(monkeypatch, sleeps):
    seen = []
    responses = [_FakeResp(503), asyncio.TimeoutError(), _FakeResp(200, _png())]
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session(responses, seen))

    raw = asyncio.run(image_service._fetch_raw_image("a red apple"))

    assert raw.startswith(b"\x89PNG")
    assert len(seen) == 3
    assert len({_seed(url) for url, _ in seen}) == 3, "every attempt uses a fresh seed"
    assert sleeps == [1.0, 2.0]


def test_three_failures_give_up(monkeypatch, sleeps):
    seen = []
    responses = [_FakeResp(502), _FakeResp(429), _FakeResp(503)]
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session(responses, seen))

    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a red apple"))
    assert len(seen) == 3


@pytest.mark.parametrize("resp", [
    _FakeResp(400),
    _FakeResp(200, b"<html>blocked</html>", ctype="text/html"),
    _FakeResp(200, b"", ctype="image/png"),
])
def test_permanent_failures_are_not_retried(monkeypatch, sleeps, resp):
    seen = []
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session([resp], seen))

    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a red apple"))
    assert len(seen) == 1
    assert sleeps == []


def test_oversized_image_is_rejected(monkeypatch, sleeps):
    monkeypatch.setattr(image_service, "MAX_RAW_IMAGE_BYTES", 1000)
    resp = _FakeResp(200, b"\x89PNG" + b"0" * 5000)
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session([resp], []))

    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a red apple"))


def test_attempts_stay_inside_the_request_budget(monkeypatch, sleeps):
    """The request is cut off at REQUEST_TIMEOUT_SECONDS, so no attempt may
    be given more time than is left, and no retry starts without time for it."""
    monkeypatch.setattr(image_service, "IMAGE_TOTAL_BUDGET_SECONDS", 4.5)
    seen = []
    responses = [asyncio.TimeoutError(), asyncio.TimeoutError(), asyncio.TimeoutError()]
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session(responses, seen))

    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a red apple"))
    # 4.5s budget: attempt 1, wait 1s (3.5 left), attempt 2, then a 2s wait
    # would leave 1.5s... so attempt 3 still runs with what remains.
    assert sleeps == [1.0, 2.0]
    assert len(seen) == 3
    assert [round(t, 1) for _, t in seen] == [4.5, 3.5, 1.5], "each attempt gets only the time left"


def test_no_retry_starts_without_time_for_it(monkeypatch, sleeps):
    monkeypatch.setattr(image_service, "IMAGE_TOTAL_BUDGET_SECONDS", 1.9)
    seen = []
    monkeypatch.setattr(image_service.aiohttp, "ClientSession", _fake_session([asyncio.TimeoutError()], seen))

    with pytest.raises(image_service.ImageProviderError):
        asyncio.run(image_service._fetch_raw_image("a red apple"))
    assert len(seen) == 1, "a 1s wait would leave under 1s, so it stops"
    assert sleeps == []


def test_default_budget_fits_the_request_timeout():
    # REQUEST_TIMEOUT_SECONDS defaults to 30; leave room to process and store.
    assert image_service.IMAGE_TOTAL_BUDGET_SECONDS <= 25.0
    assert image_service.IMAGE_ATTEMPT_TIMEOUT_SECONDS <= 30.0


def test_undecodable_bytes_raise_a_provider_error():
    with pytest.raises(image_service.ImageProviderError):
        image_service._process_image(b"definitely not an image")


# ---- through POST /api/chat ----------------------------------------------------

def _image_uses_today(db, user_id):
    db.expire_all()
    row = db.query(UsageDaily).filter_by(user_id=user_id, feature="image_gen").first()
    return row.count if row else 0


def test_failed_generation_shows_a_clear_message_and_is_not_charged(client, db, make_user, monkeypatch):
    user, headers = make_user()

    async def always_fail(prompt):
        raise image_service.ImageProviderError("Image provider returned status 503")
    monkeypatch.setattr(image_service, "_fetch_raw_image", always_fail)

    res = client.post("/api/chat", json={"message": "generate an image of a red apple"}, headers=headers)

    assert res.status_code == 502
    assert res.json()["detail"] == "Image generation is temporarily unavailable. Try again in a minute."
    assert _image_uses_today(db, user.id) == 0


def test_successful_generation_is_charged_once(client, db, make_user, monkeypatch):
    user, headers = make_user()

    async def ok(prompt):
        return _png()
    monkeypatch.setattr(image_service, "_fetch_raw_image", ok)

    res = client.post("/api/chat", json={"message": "generate an image of a red apple"}, headers=headers)

    assert res.status_code == 200, res.text
    assert _image_uses_today(db, user.id) == 1
