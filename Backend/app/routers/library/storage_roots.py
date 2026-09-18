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
    """Defense in depth against a storage_path that ever contained ".."
    segments or was itself absolute (os.path.join silently discards `root`
    for an absolute second argument) -- both would otherwise resolve
    outside the intended storage root. Every real writer sanitizes the
    filename before this is called (see upload.py's sanitize_filename),
    so this should never actually trigger; it's here in case a future
    caller doesn't."""
    root = os.path.realpath(STORAGE_ROOTS[item_type])
    resolved = os.path.realpath(os.path.join(root, storage_path))
    if os.path.commonpath([root, resolved]) != root:
        raise ValueError(f"storage_path escapes its storage root: {storage_path!r}")
    return resolved
