from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.library_item import LibraryItem
from app.models.user import User
from app.auth.dependencies import get_current_user

router = APIRouter()

SORT_COLUMNS = {"date": LibraryItem.updated_at, "name": LibraryItem.name, "size": LibraryItem.size_bytes}


@router.get("/api/library/items")
def list_items(
    type: Optional[str] = Query(None, description="chat|document|code|artifact|upload|generated"),
    parent_id: Optional[str] = Query(None, description="Folder to browse; omit to search the whole library"),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: str = Query("date", pattern="^(date|name|size)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(LibraryItem).filter(LibraryItem.user_id == user.id)

    if type:
        # A folder isn't "of a type" -- a type tab (Chats/Docs/Code/...)
        # searches flat across the whole library, the same way a real
        # file browser's type filters ignore folder structure.
        q = q.filter(LibraryItem.type == type, LibraryItem.is_folder.is_(False))
    if parent_id is not None:
        q = q.filter(LibraryItem.parent_id == (parent_id or None))
    if search:
        q = q.filter(LibraryItem.name.ilike(f"%{search}%"))
    if tag:
        # SQLite JSON column: tags are stored as a JSON array, so this
        # matches on substring presence rather than a real array contains.
        q = q.filter(LibraryItem.tags.isnot(None)).filter(LibraryItem.tags.cast(str).ilike(f'%"{tag}"%'))

    total = q.count()

    column = SORT_COLUMNS[sort]
    column = column.desc() if order == "desc" else column.asc()
    # Folders always sort first within a page, matching a normal file browser.
    items = (
        q.order_by(LibraryItem.is_folder.desc(), column)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [i.to_dict() for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": page * page_size < total,
    }
