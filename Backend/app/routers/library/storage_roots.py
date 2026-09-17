"""Where a Library item's real file lives on disk, by type. "chat" and
"code" have no entry -- their bytes live in the conversations table, not
on disk, so there is nothing to delete or download as a raw file for
them (see items_mutate.py and download.py)."""
import os

from app.services.image_service import STORAGE_ROOT as GENERATED_IMAGE_ROOT
from app.routers.upload import UPLOAD_STORAGE_ROOT

STORAGE_ROOTS = {
    "upload": UPLOAD_STORAGE_ROOT,
    "generated": GENERATED_IMAGE_ROOT,
}


def resolve_path(item_type: str, storage_path: str) -> str:
    root = STORAGE_ROOTS[item_type]
    return os.path.join(root, storage_path)
