from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.library_item import LibraryItem
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.library import register_item
from app.routers.library.schemas import CreateFolderRequest

router = APIRouter()


@router.post("/api/library/folders")
def create_folder(payload: CreateFolderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = register_item(db, user.id, "folder", name=payload.name, size_bytes=0, parent_id=payload.parent_id)
    item.is_folder = True
    db.commit()
    db.refresh(item)
    return item.to_dict()
