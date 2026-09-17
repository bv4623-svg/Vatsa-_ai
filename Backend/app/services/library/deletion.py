"""Recursive delete for library_items, including the real files on disk.
Split out of items.py to keep that module to registration/lookups only."""
import logging
import os
from typing import Dict, Optional
from sqlalchemy.orm import Session

from app.models.library_item import LibraryItem

logger = logging.getLogger("LibraryService")


def _delete_file_on_disk(storage_root: str, storage_path: Optional[str]) -> None:
    if not storage_path:
        return
    abs_path = os.path.join(storage_root, storage_path)
    try:
        if os.path.isfile(abs_path):
            os.remove(abs_path)
    except OSError:
        logger.warning("Could not remove library file on disk: %s", abs_path)


def delete_item_recursive(db: Session, item: LibraryItem, storage_roots: Dict[str, str]) -> int:
    """Deletes an item and, if it's a folder, everything inside it.
    SQLite in this app doesn't enforce ON DELETE CASCADE (no `PRAGMA
    foreign_keys=ON` is set -- see app/database.py), so cascading is done
    explicitly here rather than relied on at the DB level. Returns the
    number of rows deleted. storage_roots maps type -> absolute directory,
    used to remove the real file backing an upload/generated item."""
    deleted = 0
    if item.is_folder:
        children = db.query(LibraryItem).filter(LibraryItem.parent_id == item.id).all()
        for child in children:
            deleted += delete_item_recursive(db, child, storage_roots)

    root = storage_roots.get(item.type)
    if root:
        _delete_file_on_disk(root, item.storage_path)

    db.delete(item)
    db.commit()
    return deleted + 1
