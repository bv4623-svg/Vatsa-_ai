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
