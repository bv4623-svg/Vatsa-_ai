"""PDF/DOCX/XLSX/text upload and parsing, image attachments in chat, and
the vision endpoint. The vision model is faked."""
import base64
import io
from datetime import date

import pytest
from PIL import Image

from app.routers import upload as upload_router
from doc_fixtures import make_pdf, make_docx, make_xlsx, make_zip_bomb_docx
from llm_fakes import fake_llm  # noqa: F401  (fixture)


def _upload(client, headers, name, data, ctype="application/octet-stream"):
    return client.post("/api/upload", files={"file": (name, data, ctype)}, headers=headers)


def _png(size=(32, 32)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (10, 120, 200)).save(buf, format="PNG")
    return buf.getvalue()


# ---- auth / limits ----------------------------------------------------------

def test_upload_requires_auth(client):
    """Regression: anonymous uploads were accepted, parsed, and kept in an
    unbounded in-memory store."""
    res = client.post("/api/upload", files={"file": ("a.txt", b"hi", "text/plain")})
    assert res.status_code in (401, 403)


def test_in_memory_store_removed():
    assert not hasattr(upload_router, "FILE_STORE")


def test_empty_file_rejected(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "a.txt", b"", "text/plain")
    assert res.status_code == 400 and "empty" in res.json()["detail"].lower()


def test_oversized_file_rejected(client, make_user, monkeypatch):
    monkeypatch.setattr(upload_router, "MAX_UPLOAD_BYTES", 1024)
    _, headers = make_user()
    res = _upload(client, headers, "a.txt", b"x" * 2048, "text/plain")
    assert res.status_code == 413


def test_unsupported_type_rejected(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "setup.exe", b"MZ\x90\x00", "application/octet-stream")
    assert res.status_code == 400 and "Unsupported" in res.json()["detail"]


def test_renamed_binary_rejected_by_magic_bytes(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "report.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")
    assert res.status_code == 400


def test_path_traversal_filename_is_sanitized(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "../../etc/passwd.txt", b"hello", "text/plain")
    assert res.status_code == 200
    assert res.json()["filename"] == "passwd.txt"


def test_upload_rate_limited(client, make_user, monkeypatch):
    monkeypatch.setattr(upload_router, "UPLOADS_PER_MINUTE", 2)
    _, headers = make_user()
    codes = [_upload(client, headers, "a.txt", b"hi", "text/plain").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ---- PDF -----------------------------------------------------------------------

def test_pdf_text_extracted(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "doc.pdf", make_pdf(["Hello from page one", "Second page here"]), "application/pdf")
    assert res.status_code == 200, res.text
    body = res.json()
    assert "Hello from page one" in body["text"] and "Second page here" in body["text"]
    assert body["pages"] == 2 and body["pages_parsed"] == 2
    assert body["truncated"] is False and body["warning"] is None


def test_scanned_pdf_returns_warning(client, make_user):
    """Regression: an image-only PDF came back as empty text with no
    explanation, so the model silently saw nothing."""
    _, headers = make_user()
    body = _upload(client, headers, "scan.pdf", make_pdf([None, None]), "application/pdf").json()
    assert body["text"] == ""
    assert "scanned" in body["warning"].lower()


def test_corrupted_pdf_returns_clear_error(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "bad.pdf", b"%PDF-1.4\n garbage garbage", "application/pdf")
    assert res.status_code == 422
    assert "corrupted" in res.json()["detail"].lower()


def test_encrypted_pdf_returns_clear_error(client, make_user):
    _, headers = make_user()
    res = _upload(client, headers, "locked.pdf", make_pdf(["secret"], encrypt=True), "application/pdf")
    assert res.status_code == 422
    assert "password" in res.json()["detail"].lower()


def test_large_pdf_is_page_capped_and_flagged(client, make_user, monkeypatch):
    monkeypatch.setattr(upload_router, "MAX_PDF_PAGES", 3)
    _, headers = make_user()
    body = _upload(client, headers, "big.pdf", make_pdf([f"page {i}" for i in range(10)]), "application/pdf").json()
    assert body["pages"] == 10 and body["pages_parsed"] == 3
    assert body["truncated"] is True
    assert "page 2" in body["text"] and "page 5" not in body["text"]


def test_long_text_truncated_and_flagged(client, make_user, monkeypatch):
    monkeypatch.setattr(upload_router, "MAX_EXTRACTED_CHARS", 100)
    _, headers = make_user()
    body = _upload(client, headers, "long.txt", b"a" * 500, "text/plain").json()
    assert body["chars"] == 100 and body["truncated"] is True


# ---- Office / text ----------------------------------------------------------------

def test_docx_extracted(client, make_user):
    _, headers = make_user()
    body = _upload(client, headers, "notes.docx", make_docx(["Quarterly notes", "Revenue grew"])).json()
    assert "Quarterly notes" in body["text"] and "Revenue grew" in body["text"]


def test_xlsx_extracted(client, make_user):
    _, headers = make_user()
    body = _upload(client, headers, "sheet.xlsx", make_xlsx([["name", "qty"], ["apple", 3]])).json()
    assert "--- Sheet: Data ---" in body["text"] and "apple, 3" in body["text"]
    assert body["sheets"] == 1


def test_zip_bomb_docx_refused(client, make_user, monkeypatch):
    monkeypatch.setattr(upload_router, "MAX_UNCOMPRESSED_OFFICE_BYTES", 1024 * 1024)
    _, headers = make_user()
    res = _upload(client, headers, "bomb.docx", make_zip_bomb_docx(5 * 1024 * 1024))
    assert res.status_code == 422


def test_text_file_with_bom_and_bad_bytes(client, make_user):
    _, headers = make_user()
    body = _upload(client, headers, "a.csv", "﻿name,city\nZoë,Paris\n".encode("utf-8") + b"\xff", "text/csv").json()
    assert body["text"].startswith("name,city") and "Zoë" in body["text"]


def test_upload_is_registered_in_library(client, make_user):
    _, headers = make_user()
    _upload(client, headers, "keep.txt", b"keep me", "text/plain")
    items = client.get("/api/library/items", headers=headers)
    assert items.status_code == 200
    assert "keep.txt" in items.text


# ---- image attachments in chat ---------------------------------------------------------

def _img_att(data_url, name="p.png", ctype="image/png"):
    return {"name": name, "type": ctype, "is_base64": True, "content": data_url}


def test_image_attachment_reaches_model_as_vision_input(client, make_user, fake_llm):
    _, headers = make_user()
    url = "data:image/png;base64," + base64.b64encode(_png()).decode()
    res = client.post("/api/chat", json={"message": "what is this?", "attachments": [_img_att(url)]}, headers=headers)
    assert res.status_code == 200, res.text
    user_turn = fake_llm["messages"][0][-1]
    assert isinstance(user_turn["content"], list)
    assert user_turn["content"][1]["image_url"]["url"] == url


@pytest.mark.parametrize("att,code", [
    (_img_att("data:image/svg+xml;base64,PHN2Zz4=", "x.svg", "image/svg+xml"), 400),
    (_img_att("https://evil.example/x.png"), 400),
    (_img_att("data:image/png;base64,@@@not-base64@@@"), 400),
    ({"name": "a.zip", "type": "application/zip", "is_base64": True, "content": "data:application/zip;base64,UEsDBA=="}, 400),
])
def test_bad_image_attachments_rejected(client, make_user, fake_llm, att, code):
    """Regression: unsupported attachments were silently dropped while the
    user saw them attached."""
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "look", "attachments": [att]}, headers=headers)
    assert res.status_code == code
    assert fake_llm["calls"] == []


def test_oversized_image_attachment_rejected(client, make_user, fake_llm):
    _, headers = make_user()
    big = "data:image/png;base64," + "A" * (12 * 1024 * 1024)
    res = client.post("/api/chat", json={"message": "look", "attachments": [_img_att(big)]}, headers=headers)
    assert res.status_code == 413


def test_too_many_images_rejected(client, make_user, fake_llm):
    _, headers = make_user()
    url = "data:image/png;base64," + base64.b64encode(_png()).decode()
    res = client.post("/api/chat", json={"message": "look", "attachments": [_img_att(url)] * 5}, headers=headers)
    assert res.status_code == 400


# ---- vision endpoint -----------------------------------------------------------

def _vision(client, headers, data, name="p.png", ctype="image/png", prompt=None):
    form = {"prompt": prompt} if prompt else None
    return client.post("/api/vision/analyze", files={"file": (name, data, ctype)}, data=form, headers=headers)


def test_vision_is_pro_only(client, make_user, fake_llm):
    _, headers = make_user(tier="free")
    res = _vision(client, headers, _png())
    assert res.status_code == 402
    assert res.json()["detail"]["error"] == "upgrade_required"


def test_vision_happy_path(client, make_user, fake_llm):
    fake_llm["default"] = '{"description": "A blue square", "tags": ["blue"], "objects": [], "extracted_text": ""}'
    _, headers = make_user(tier="pro")
    res = _vision(client, headers, _png())
    assert res.status_code == 200, res.text
    assert res.json()["description"] == "A blue square"
    assert res.json()["tags"] == ["blue"]


def test_vision_tolerates_non_json_model_output(client, make_user, fake_llm):
    fake_llm["default"] = "Just a sentence."
    _, headers = make_user(tier="pro")
    assert _vision(client, headers, _png()).json()["description"] == "Just a sentence."


def test_vision_rejects_spoofed_content_type(client, make_user, fake_llm):
    _, headers = make_user(tier="pro")
    res = _vision(client, headers, b"<script>alert(1)</script>", ctype="image/png")
    assert res.status_code == 400
    assert fake_llm["calls"] == []


def test_vision_rejects_empty_and_huge(client, make_user, fake_llm, monkeypatch):
    from app.routers import vision
    _, headers = make_user(tier="pro")
    assert _vision(client, headers, b"").status_code == 400
    monkeypatch.setattr(vision, "MAX_IMAGE_BYTES", 100)
    assert _vision(client, headers, _png((200, 200))).status_code == 413


def test_vision_failure_does_not_use_quota_or_leak(client, make_user, fake_llm, db):
    from app.models.usage_daily import UsageDaily
    from llm_fakes import registry
    user, headers = make_user(tier="pro")
    for spec in registry().resolve("vision").candidates():
        fake_llm["script"][spec.model] = RuntimeError("OpenRouter [500]: openai/gpt-4o exploded")
    res = _vision(client, headers, _png())
    assert res.status_code == 502 and "openai" not in res.text.lower()
    row = db.query(UsageDaily).filter_by(user_id=user.id, feature="vision").first()
    assert row is None or row.count == 0


def test_vision_daily_limit(client, make_user, fake_llm, db):
    from app.models.usage_daily import UsageDaily
    user, headers = make_user(tier="pro")
    db.add(UsageDaily(user_id=user.id, feature="vision", date=date.today(), count=100))
    db.commit()
    assert _vision(client, headers, _png()).status_code == 429
