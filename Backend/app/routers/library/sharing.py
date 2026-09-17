import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.library_item import LibraryItem
from app.routers.library.deps import get_owned_item
from app.routers.library.storage_roots import resolve_path
from app.services.library import create_share_link, get_by_share_token, revoke_share_link

router = APIRouter()


@router.post("/api/library/items/{item_id}/share")
def share_item(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    if item.is_folder:
        raise HTTPException(status_code=400, detail="Folders cannot be shared")
    token = create_share_link(db, item)
    # Deliberately not under /library -- that prefix requires a session
    # (see frontend proxy.ts), and a share link must work for a logged-out
    # visitor.
    return {"share_token": token, "url": f"/share/{token}"}


@router.delete("/api/library/items/{item_id}/share")
def unshare_item(item: LibraryItem = Depends(get_owned_item), db: Session = Depends(get_db)):
    revoke_share_link(db, item)
    return {"success": True}


@router.get("/api/library/share/{token}")
def view_shared_item(token: str, db: Session = Depends(get_db)):
    """Public: no auth required, deliberately. The token itself (a 43-char
    random string) is the credential -- same model as a Google Drive
    share link. Never leaks anything beyond what create_share_link()
    explicitly opted into by minting a token for that one item."""
    item = get_by_share_token(db, token)
    if not item:
        raise HTTPException(status_code=404, detail="This share link is invalid or has been revoked")

    data = item.to_dict()
    if item.storage_path:
        abs_path = resolve_path(item.type, item.storage_path)
        if os.path.isfile(abs_path):
            data["previewUrl"] = f"/api/library/share/{token}/file"
    return data


@router.get("/api/library/share/{token}/file")
def download_shared_file(token: str, db: Session = Depends(get_db)):
    item = get_by_share_token(db, token)
    if not item or not item.storage_path:
        raise HTTPException(status_code=404, detail="This share link is invalid or has been revoked")
    abs_path = resolve_path(item.type, item.storage_path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(abs_path, filename=item.name, media_type=item.mime or "application/octet-stream")
