import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem
from app.auth.jwt import create_media_token
from app.routers.library.deps import get_owned_item
from app.routers.library.storage_roots import resolve_path

router = APIRouter()

# Same absolute-URL pattern chat.py uses for generated-image <img> tags
# embedded in message content -- the frontend renders this URL directly
# against the backend, not through the Next.js proxy.
from app.config.urls import BACKEND_PUBLIC_URL  # env BACKEND_PUBLIC_URL, else the live API

# Read-only preview: enough to render something useful without shipping an
# entire long-running chat's full history in one response.
MAX_PREVIEW_MESSAGES = 50


@router.get("/api/library/items/{item_id}/preview")
def preview_item(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    if item.is_folder:
        return {"kind": "folder"}

    if item.type in ("chat", "code") and item.source_table == "conversations":
        conv = db.query(Conversation).filter(Conversation.id == item.source_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        messages = list(conv.messages or [])[-MAX_PREVIEW_MESSAGES:]
        return {"kind": "messages", "title": conv.title, "workspace": conv.workspace, "messages": messages}

    if item.type == "generated" and item.storage_path:
        abs_path = resolve_path(item.type, item.storage_path)
        if not os.path.isfile(abs_path):
            raise HTTPException(status_code=404, detail="Image not found on disk")
        # Same scoped-token pattern chat.py already uses for <img src> --
        # never the caller's own session token in a URL.
        token = create_media_token(item.user_id)
        return {"kind": "image", "url": f"{BACKEND_PUBLIC_URL}/api/files/{item.source_id}/preview?token={token}"}

    if item.type == "upload" and item.storage_path:
        abs_path = resolve_path(item.type, item.storage_path)
        if not os.path.isfile(abs_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        text = None
        if (item.mime or "").startswith("text/") or (item.name or "").lower().endswith((".txt", ".md", ".json", ".csv")):
            with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read(20_000)
        return {"kind": "file", "mime": item.mime, "text": text}

    return {"kind": "unsupported"}
