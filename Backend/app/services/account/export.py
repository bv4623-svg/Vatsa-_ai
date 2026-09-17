import json
import os
import zipfile
from io import BytesIO

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.conversation import Conversation
from app.models.memory import Memory
from app.models.library_item import LibraryItem
from app.models.scheduled_task import ScheduledTask
from app.models.chat_project import ChatProject


def _write_json(zf: zipfile.ZipFile, name: str, rows: list) -> None:
    zf.writestr(name, json.dumps(rows, indent=2, default=str))


def build_account_export_zip(db: Session, user: User) -> bytes:
    """A real, complete account export -- every row the account owns
    (never a sample or a client-side snapshot of local state) plus the
    actual bytes of every uploaded/generated file, following the same
    live-generation convention as library/download.py's per-item export.
    """
    # Imported here, not at module load: app.routers.library pulls in
    # app.routers.upload, which itself needs this service package (for
    # quota-warning notifications), so a top-level import here would be
    # circular. By call time every module is already fully loaded.
    from app.routers.library.storage_roots import STORAGE_ROOTS, resolve_path

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        _write_json(zf, "profile.json", [user.to_dict()])

        convs = db.query(Conversation).filter(Conversation.user_id == user.id).all()
        _write_json(zf, "conversations.json", [c.to_dict() for c in convs])

        _write_json(zf, "memories.json", [m.to_dict() for m in db.query(Memory).filter(Memory.user_id == user.id).all()])

        items = db.query(LibraryItem).filter(LibraryItem.user_id == user.id).all()
        _write_json(zf, "library_items.json", [i.to_dict() for i in items])

        tasks = db.query(ScheduledTask).filter(ScheduledTask.user_id == user.id).all()
        _write_json(zf, "scheduled_tasks.json", [t.to_dict() for t in tasks])

        projects = db.query(ChatProject).filter(ChatProject.user_id == user.id).all()
        _write_json(zf, "projects.json", [p.to_dict() for p in projects])

        for item in items:
            if not item.storage_path or item.type not in STORAGE_ROOTS:
                continue
            abs_path = resolve_path(item.type, item.storage_path)
            if os.path.isfile(abs_path):
                # Prefixed with a short id: two uploads can share a name.
                zf.write(abs_path, arcname=f"files/{item.type}/{item.id[:8]}_{item.name}")

    return buf.getvalue()
