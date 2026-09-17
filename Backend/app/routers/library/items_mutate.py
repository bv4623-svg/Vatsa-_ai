from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.library import delete_item_recursive
from app.routers.library.deps import get_owned_item
from app.routers.library.schemas import BulkIdsRequest, BulkMoveRequest, UpdateItemRequest
from app.routers.library.storage_roots import STORAGE_ROOTS

router = APIRouter()


def _delete_with_source(db: Session, item: LibraryItem) -> None:
    """Deleting a chat/code Library item also deletes the Conversation it
    mirrors -- otherwise the next message sent in that conversation would
    resurrect the item via sync_conversation_item, and a delete that
    silently undoes itself is worse than no delete button at all."""
    if item.type in ("chat", "code") and item.source_table == "conversations":
        db.query(Conversation).filter(
            Conversation.id == item.source_id, Conversation.user_id == item.user_id
        ).delete(synchronize_session=False)
    delete_item_recursive(db, item, STORAGE_ROOTS)


@router.patch("/api/library/items/{item_id}")
def update_item(payload: UpdateItemRequest, item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    if payload.name is not None:
        item.name = payload.name
    if payload.parent_id is not None:
        item.parent_id = payload.parent_id or None
    if payload.tags is not None:
        item.tags = payload.tags
    db.commit()
    db.refresh(item)
    return item.to_dict()


@router.delete("/api/library/items/{item_id}")
def delete_item(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    _delete_with_source(db, item)
    return {"success": True}


@router.post("/api/library/items/bulk-delete")
def bulk_delete(payload: BulkIdsRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(LibraryItem).filter(LibraryItem.id.in_(payload.ids), LibraryItem.user_id == user.id).all()
    for item in items:
        _delete_with_source(db, item)
    return {"success": True, "deleted": len(items)}


@router.post("/api/library/items/bulk-move")
def bulk_move(payload: BulkMoveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(LibraryItem).filter(LibraryItem.id.in_(payload.ids), LibraryItem.user_id == user.id).all()
    for item in items:
        item.parent_id = payload.parent_id or None
    db.commit()
    return {"success": True, "moved": len(items)}
