"""detect_image_gen() against the cases shared with the frontend
(shared/image-intent-cases.json; frontend/scripts/check-image-query.mjs runs
the same file against frontend/src/lib/home/imageQuery.ts)."""
import json
from pathlib import Path

import pytest

from app.services.ai_service import detect_image_gen

CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "image-intent-cases.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", CASES["chat"], ids=lambda c: c["text"][:50] or "(empty)")
def test_chat_cases(case):
    assert detect_image_gen(case["text"]) == case["prompt"]


@pytest.mark.parametrize("case", CASES["code_workspace"], ids=lambda c: c["text"][:50])
def test_code_workspace_never_generates_images(case):
    assert detect_image_gen(case["text"], workspace="code") == case["prompt"]


def test_the_shared_file_covers_both_sides():
    images = [c for c in CASES["chat"] if c["prompt"] is not None]
    texts = [c for c in CASES["chat"] if c["prompt"] is None]
    assert len(images) >= 15 and len(texts) >= 6


def test_prompt_is_capped():
    assert len(detect_image_gen("generate an image of " + "a very long scene " * 200)) <= 1000


def test_hinglish_request_reaches_the_image_provider(client, make_user, monkeypatch):
    """End to end through POST /api/chat: a Hinglish request is routed to
    image generation with the cleaned subject as the prompt."""
    import io
    from PIL import Image
    from app.services import image_service

    prompts = []

    async def fake_fetch(prompt):
        prompts.append(prompt)
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (30, 120, 200)).save(buf, format="PNG")
        return buf.getvalue()

    monkeypatch.setattr(image_service, "_fetch_raw_image", fake_fetch)
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "ek red apple ki photo banao"}, headers=headers)

    assert res.status_code == 200, res.text
    assert res.json()["primary_intent"] == "image_generation"
    assert prompts == ["red apple"]
