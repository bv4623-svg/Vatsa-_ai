"""POST /api/upload: every allowed file type (image, text/code, PDF/DOCX/
XLSX) goes through one real pipeline -- validated, persisted via
StorageBackend, registered as a real LibraryItem, and counted toward the
user's storage quota. See app/routers/upload.py."""
import io
from unittest.mock import patch

from app.models.library_item import LibraryItem

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
    "53de0000000c4944415408d763f8cfc0c0c0c40000030101002d3e"
    "6be40000000049454e44ae426082"
)


def _upload(client, headers, filename, content: bytes, content_type: str):
    return client.post(
        "/api/upload",
        headers=headers,
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


def test_text_file_is_persisted_and_registered_in_library(client, db, make_user):
    _, headers = make_user(email="upload-text@example.com")
    res = _upload(client, headers, "notes.txt", b"hello from a real text file", "text/plain")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["text"] == "hello from a real text file"
    assert body["url"] is not None
    assert body["mime_type"]
    assert body["thumbnail_url"] is None

    item = db.query(LibraryItem).filter_by(id=body["id"]).first()
    assert item is not None
    assert item.type == "upload"
    assert item.size_bytes == len(b"hello from a real text file")


def test_image_file_gets_a_thumbnail_and_no_text(client, db, make_user):
    _, headers = make_user(email="upload-image@example.com")
    res = _upload(client, headers, "pixel.png", PNG_1PX, "image/png")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["text"] == ""
    assert body["thumbnail_url"] is not None
    assert body["mime_type"] == "image/png"

    item = db.query(LibraryItem).filter_by(id=body["id"]).first()
    assert item.mime == "image/png"


def test_renamed_exe_disguised_as_png_is_rejected(client, make_user):
    _, headers = make_user(email="upload-fake-png@example.com")
    res = _upload(client, headers, "totally-a-photo.png", b"MZ\x90\x00 not a real png", "image/png")
    assert res.status_code == 400, res.text
    assert "doesn't match" in res.json()["detail"]


def test_unsupported_extension_is_rejected(client, make_user):
    _, headers = make_user(email="upload-exe@example.com")
    res = _upload(client, headers, "virus.exe", b"MZ\x90\x00", "application/octet-stream")
    assert res.status_code == 400, res.text
    assert "Unsupported file type" in res.json()["detail"]


def test_file_over_25mb_is_rejected(client, make_user):
    _, headers = make_user(email="upload-toobig@example.com")
    big = b"a" * (25 * 1024 * 1024 + 1)
    res = _upload(client, headers, "big.txt", big, "text/plain")
    assert res.status_code == 400, res.text
    assert "too large" in res.json()["detail"].lower()


def test_empty_file_is_rejected(client, make_user):
    _, headers = make_user(email="upload-empty@example.com")
    res = _upload(client, headers, "empty.txt", b"", "text/plain")
    assert res.status_code == 400, res.text


def test_unauthenticated_upload_is_not_persisted_but_still_extracts_text(client):
    """Anonymous uploads (no account) can't be measured against a plan, so
    they're allowed through for immediate use, but nothing is written to
    storage or Library -- there's no user to own that row."""
    res = _upload(client, {}, "anon.txt", b"anonymous content", "text/plain")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["text"] == "anonymous content"
    assert body["url"] is None


def test_upload_over_quota_is_rejected_with_413(client, make_user):
    _, headers = make_user(email="upload-overquota@example.com")
    with patch(
        "app.routers.upload.check_quota",
        return_value=(False, {"used_bytes": 999, "limit_bytes": 1000, "at_warning": True}),
    ):
        res = _upload(client, headers, "notes.txt", b"content", "text/plain")
    assert res.status_code == 413, res.text
    assert res.json()["detail"]["error"] == "storage_limit_reached"


def test_uploaded_file_survives_a_fresh_read_and_can_be_downloaded(client, db, make_user):
    _, headers = make_user(email="upload-download@example.com")
    upload_res = _upload(client, headers, "roundtrip.txt", b"round trip content", "text/plain")
    item_id = upload_res.json()["id"]

    download_res = client.get(f"/api/library/items/{item_id}/download", headers=headers)
    assert download_res.status_code == 200, download_res.text
    assert download_res.content == b"round trip content"


def test_image_thumbnail_is_downloadable(client, make_user):
    _, headers = make_user(email="upload-thumb-download@example.com")
    upload_res = _upload(client, headers, "pixel2.png", PNG_1PX, "image/png")
    item_id = upload_res.json()["id"]

    thumb_res = client.get(f"/api/library/items/{item_id}/thumbnail", headers=headers)
    assert thumb_res.status_code == 200, thumb_res.text
    assert thumb_res.headers["content-type"] == "image/jpeg"


def test_deleting_the_library_item_removes_it_from_storage(client, db, make_user):
    _, headers = make_user(email="upload-delete@example.com")
    upload_res = _upload(client, headers, "todelete.txt", b"delete me", "text/plain")
    item_id = upload_res.json()["id"]

    del_res = client.delete(f"/api/library/items/{item_id}", headers=headers)
    assert del_res.status_code == 200, del_res.text
    assert db.query(LibraryItem).filter_by(id=item_id).first() is None

    download_res = client.get(f"/api/library/items/{item_id}/download", headers=headers)
    assert download_res.status_code == 404


def test_uploaded_file_appears_in_library_uploads_tab(client, make_user):
    _, headers = make_user(email="upload-list@example.com")
    _upload(client, headers, "listed.txt", b"should be listed", "text/plain")

    res = client.get("/api/library/items?type=upload", headers=headers)
    assert res.status_code == 200, res.text
    names = [i["name"] for i in res.json()["items"]]
    assert "listed.txt" in names


def test_a_users_upload_is_not_downloadable_by_another_user(client, make_user):
    _, headers_a = make_user(email="upload-owner@example.com")
    _, headers_b = make_user(email="upload-intruder@example.com")
    upload_res = _upload(client, headers_a, "private.txt", b"private content", "text/plain")
    item_id = upload_res.json()["id"]

    res = client.get(f"/api/library/items/{item_id}/download", headers=headers_b)
    assert res.status_code == 404
