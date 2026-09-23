import os
import uuid
from typing import Optional

from fastapi import UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.models.user import User
from app.services.library import register_item, check_quota
from app.services.account import notify_quota_warning

from app.routers.upload.sanitize import sanitize_filename
from app.routers.upload.extractors import extract_text_from_bytes
from app.routers.upload.router import router, logger, UPLOAD_STORAGE_ROOT

FILE_STORE = {}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 25MB)")

    filename = sanitize_filename(file.filename or "file")

    # Signed-in users: block before writing, once their Library is full.
    # Anonymous uploads (no account, nothing persisted) can't be measured
    # against a plan, so they're unaffected -- same as before this check.
    if current_user:
        allowed, usage = check_quota(db, current_user, len(raw))
        if not allowed:
            notify_quota_warning(db, current_user, usage["used_bytes"], usage["limit_bytes"], at_limit=True)
            raise HTTPException(status_code=413, detail={
                "error": "storage_limit_reached",
                "used_bytes": usage["used_bytes"],
                "limit_bytes": usage["limit_bytes"],
                "upgrade_url": "/pricing",
            })
        elif usage["at_warning"]:
            notify_quota_warning(db, current_user, usage["used_bytes"], usage["limit_bytes"], at_limit=False)

    try:
        text = extract_text_from_bytes(raw, filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")

    text = (text or "").strip()[:50000]
    file_id = str(uuid.uuid4())
    FILE_STORE[file_id] = {
        "filename": filename,
        "text": text,
        "size_bytes": len(raw),
        "user_id": current_user.id if current_user else None
    }

    # Persist the real bytes and register a Library row so the upload
    # survives past this in-memory FILE_STORE (which the existing chat
    # flow that reads it back is unaffected by -- this is additive).
    if current_user:
        try:
            user_dir = os.path.join(UPLOAD_STORAGE_ROOT, str(current_user.id))
            os.makedirs(user_dir, exist_ok=True)
            storage_path = os.path.join(str(current_user.id), f"{file_id}_{filename}")
            with open(os.path.join(UPLOAD_STORAGE_ROOT, storage_path), "wb") as f:
                f.write(raw)

            register_item(
                db, current_user.id, "upload", name=filename, size_bytes=len(raw),
                mime=file.content_type, source_table="uploads", source_id=file_id,
                storage_path=storage_path,
            )
        except Exception:
            logger.exception("Library registration failed for upload %s", file_id)

    return {
        "file_id": file_id,
        "filename": filename,
        "chars": len(text),
        "size_bytes": len(raw),
        "text": text
    }
