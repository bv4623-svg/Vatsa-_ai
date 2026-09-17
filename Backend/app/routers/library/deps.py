from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.library_item import LibraryItem
from app.models.user import User
from app.auth.dependencies import get_current_user


def get_owned_item(item_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> LibraryItem:
    """Same 404 whether the item doesn't exist or belongs to someone
    else -- never confirms another user's item id exists."""
    item = db.query(LibraryItem).filter(LibraryItem.id == item_id).first()
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
