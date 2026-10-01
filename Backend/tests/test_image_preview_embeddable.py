"""Generated images are shown by the frontend with <img src="https://api.../
api/files/<id>/preview?token=...">, from a different origin than the API.
Browsers refuse to display a cross-origin image whose response says
Cross-Origin-Resource-Policy: same-origin, which is what every image got
from 2026-09-18 (the security headers middleware sets it on every
response). The image route has to opt out; everything else stays
same-origin."""
import io
from urllib.parse import urlsplit

from PIL import Image

from app.services import image_service


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 30, 30)).save(buf, format="PNG")
    return buf.getvalue()


def _generate_image(client, headers, monkeypatch) -> str:
    """The real chat path (detection, limits, processing, storage, URL),
    with only the provider's network call replaced."""
    async def fake_fetch(prompt: str) -> bytes:
        return _png_bytes()

    monkeypatch.setattr(image_service, "_fetch_raw_image", fake_fetch)
    res = client.post("/api/chat", json={"message": "generate an image of a red apple"}, headers=headers)
    assert res.status_code == 200, res.text
    url = res.json()["image_url"]
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


def test_generated_image_can_be_embedded_by_the_frontend(client, make_user, monkeypatch):
    _, headers = make_user()
    image_path = _generate_image(client, headers, monkeypatch)

    res = client.get(image_path)

    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.headers["Cross-Origin-Resource-Policy"] == "cross-origin"
    # The rest of the security headers are still applied to the image.
    assert res.headers["X-Content-Type-Options"] == "nosniff"


def test_image_route_still_needs_the_media_token(client, make_user, monkeypatch):
    _, headers = make_user()
    image_path = _generate_image(client, headers, monkeypatch)

    res = client.get(image_path.split("?")[0])

    assert res.status_code == 401


def test_other_responses_stay_same_origin(client, make_user, monkeypatch):
    _, headers = make_user()
    image_path = _generate_image(client, headers, monkeypatch)
    missing = image_path.replace(image_path.split("/")[3], "0" * 32, 1)

    assert client.get("/health").headers["Cross-Origin-Resource-Policy"] == "same-origin"
    assert client.get("/api/conversations", headers=headers).headers["Cross-Origin-Resource-Policy"] == "same-origin"
    # An error from the image route itself carries no image, so it keeps the default.
    not_found = client.get(missing)
    assert not_found.status_code == 404
    assert not_found.headers["Cross-Origin-Resource-Policy"] == "same-origin"
