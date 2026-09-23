"""B12: generate_and_store_image and POST /api/upload now write through
the StorageBackend abstraction instead of calling open()/os.makedirs()
directly -- confirms that migration didn't change where the bytes end up
for the default (local) backend."""
import asyncio
import os

from app.auth.jwt import decode_access_token
from app.routers.upload import UPLOAD_STORAGE_ROOT


def _user_dir_for(headers, root) -> str:
    token = headers["Authorization"].split(" ", 1)[1]
    payload = decode_access_token(token)
    return os.path.join(root, str(payload["sub"]))


def test_upload_writes_the_real_bytes_under_upload_storage_root(client, make_user):
    _, headers = make_user()
    res = client.post(
        "/api/upload",
        files={"file": ("note.txt", b"hello from a real upload", "text/plain")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    file_id = res.json()["file_id"]

    user_dir = _user_dir_for(headers, UPLOAD_STORAGE_ROOT)
    assert os.path.isdir(user_dir)
    matches = [f for f in os.listdir(user_dir) if f.startswith(file_id)]
    assert matches, "expected the uploaded file to exist under UPLOAD_STORAGE_ROOT/<user_id>/"
    with open(os.path.join(user_dir, matches[0]), "rb") as f:
        assert f.read() == b"hello from a real upload"


def test_generate_and_store_image_writes_through_the_storage_backend(db, make_user, monkeypatch):
    import app.services.image_service as image_service

    async def fake_fetch(prompt):
        return b"not a real png, just test bytes"

    def fake_process(raw):
        return raw  # skip real Pillow processing/branding for this test

    monkeypatch.setattr(image_service, "_fetch_raw_image", fake_fetch)
    monkeypatch.setattr(image_service, "_process_image", fake_process)

    user, _ = make_user()
    result = asyncio.run(image_service.generate_and_store_image(db, user.id, "a test prompt"))

    abs_path = image_service.resolve_image_path(os.path.join(str(user.id), f"{result['image_id']}.png"))
    assert os.path.isfile(abs_path)
    with open(abs_path, "rb") as f:
        assert f.read() == b"not a real png, just test bytes"
