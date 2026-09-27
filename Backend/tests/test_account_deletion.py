"""Account deletion: the grace-period hard delete must remove the user's
files on disk (uploads, generated images), not only their database rows."""
import io
import os
from datetime import datetime, timedelta, timezone

from PIL import Image

from app.models.user import User
from app.routers.upload import UPLOAD_STORAGE_ROOT
from app.services import image_service
from app.services.account.deletion import hard_delete_expired_accounts


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (1, 2, 3)).save(buf, format="PNG")
    return buf.getvalue()


def test_hard_delete_removes_uploads_and_generated_images(client, make_user, db, monkeypatch):
    user, headers = make_user()
    other, other_headers = make_user()
    uid, other_id = user.id, other.id  # the ORM objects go stale once rows are deleted
    assert client.post("/api/upload", files={"file": ("mine.txt", b"private", "text/plain")}, headers=headers).status_code == 200
    assert client.post("/api/upload", files={"file": ("keep.txt", b"theirs", "text/plain")}, headers=other_headers).status_code == 200

    async def fake_fetch(prompt):
        return _png()
    monkeypatch.setattr(image_service, "_fetch_raw_image", fake_fetch)
    assert client.post("/api/chat", json={"message": "generate an image of a cat"}, headers=headers).status_code == 200

    uploads_dir = os.path.join(UPLOAD_STORAGE_ROOT, str(uid))
    images_dir = os.path.join(image_service.STORAGE_ROOT, str(uid))
    assert os.listdir(uploads_dir) and os.listdir(images_dir)

    # Soft delete, then move past the 30-day grace period.
    assert client.post("/api/account/delete", json={"password": "a-long-test-password-1", "confirm": True}, headers=headers).status_code == 200
    row = db.query(User).filter_by(id=uid).first()
    row.deleted_at = datetime.now(timezone.utc) - timedelta(days=31)
    db.commit()

    assert hard_delete_expired_accounts() >= 1
    db.expire_all()
    assert db.query(User).filter_by(id=uid).first() is None
    assert not os.path.exists(uploads_dir), "deleted user's uploads must be removed from disk"
    assert not os.path.exists(images_dir), "deleted user's generated images must be removed from disk"
    # Other users' files are untouched.
    assert os.listdir(os.path.join(UPLOAD_STORAGE_ROOT, str(other_id)))
