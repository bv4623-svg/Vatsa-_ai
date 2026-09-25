import json
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem
from app.routers.library.deps import get_owned_item
from app.routers.library.storage_roots import resolve_path

router = APIRouter()


@router.get("/api/library/items/{item_id}/download")
def download_item(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    if item.is_folder:
        raise HTTPException(status_code=400, detail="Folders cannot be downloaded directly")

    if item.type == "upload" and item.storage_path:
        # Goes through the same StorageBackend upload.py wrote with (local
        # disk or S3/R2), unlike resolve_path()'s raw filesystem read below
        # which only ever looks on local disk -- would 404 every upload
        # once STORAGE_BACKEND=s3 is set.
        from app.routers.upload import upload_storage
        try:
            data = upload_storage.get(item.storage_path)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File not found in storage")
        return Response(
            content=data,
            media_type=item.mime or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{item.name}"'},
        )

    if item.storage_path:
        abs_path = resolve_path(item.type, item.storage_path)
        if not os.path.isfile(abs_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        return FileResponse(abs_path, filename=item.name, media_type=item.mime or "application/octet-stream")

    if item.type in ("chat", "code") and item.source_table == "conversations":
        conv = db.query(Conversation).filter(Conversation.id == item.source_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        payload = json.dumps({"title": conv.title, "workspace": conv.workspace, "messages": conv.messages or []}, indent=2, default=str)
        return Response(
            content=payload,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{item.name or "chat"}.json"'},
        )

    raise HTTPException(status_code=404, detail="Nothing to download for this item")


@router.get("/api/library/items/{item_id}/thumbnail")
def download_thumbnail(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    if item.type != "upload" or not item.storage_path or not (item.mime or "").startswith("image/"):
        raise HTTPException(status_code=404, detail="No thumbnail for this item")

    from app.routers.upload import upload_storage, thumbnail_key_for
    try:
        data = upload_storage.get(thumbnail_key_for(item.storage_path))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return Response(content=data, media_type="image/jpeg")
