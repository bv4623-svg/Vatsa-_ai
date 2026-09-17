"""Registration and lookups for library_items. register_item() is the
single place a row is created, called from every real producer (chat/code
persistence, image generation, uploads) so nothing in Library is ever
fabricated -- if there's a row, something real produced those bytes."""
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.library_item import LibraryItem


def register_item(
    db: Session,
    user_id: int,
    item_type: str,
    name: str,
    size_bytes: int,
    mime: Optional[str] = None,
    parent_id: Optional[str] = None,
    tags: Optional[List[str]] = None,
    source_table: Optional[str] = None,
    source_id: Optional[str] = None,
    storage_path: Optional[str] = None,
) -> LibraryItem:
    item = LibraryItem(
        id=uuid.uuid4().hex,
        user_id=user_id,
        type=item_type,
        name=name,
        size_bytes=max(0, size_bytes),
        mime=mime,
        parent_id=parent_id,
        tags=tags or [],
        source_table=source_table,
        source_id=source_id,
        storage_path=storage_path,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def sync_conversation_item(db: Session, user_id: int, conversation_id: str, title: str, workspace: str, size_bytes: int) -> None:
    """Upserts the library row backing one conversation. Called every time
    chat.py finishes persisting an exchange, so size_bytes always matches
    the real serialized message JSON -- never a stale snapshot from
    creation time. type is "code" for the code workspace, "chat"
    otherwise, both driven by the same Conversation.workspace column."""
    item_type = "code" if workspace == "code" else "chat"
    existing = (
        db.query(LibraryItem)
        .filter(
            LibraryItem.user_id == user_id,
            LibraryItem.source_table == "conversations",
            LibraryItem.source_id == conversation_id,
        )
        .first()
    )
    if existing:
        existing.name = title or existing.name
        existing.size_bytes = max(0, size_bytes)
        existing.type = item_type
        db.commit()
        return

    register_item(
        db, user_id, item_type, title or "Untitled", size_bytes,
        mime="application/json", source_table="conversations", source_id=conversation_id,
    )


def delete_conversation_item(db: Session, user_id: int, conversation_id: str) -> None:
    """Keeps Library in step when a conversation is deleted elsewhere."""
    db.query(LibraryItem).filter(
        LibraryItem.user_id == user_id,
        LibraryItem.source_table == "conversations",
        LibraryItem.source_id == conversation_id,
    ).delete(synchronize_session=False)
    db.commit()


def to_public_dict(item: LibraryItem) -> Dict[str, Any]:
    return item.to_dict()
