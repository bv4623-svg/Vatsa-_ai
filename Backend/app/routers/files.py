import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.generated_image import GeneratedImage
from app.auth.dependencies import get_user_for_media
from app.services.image_service import resolve_image_path

logger = logging.getLogger("FilesRouter")
router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{image_id}/preview")
async def preview_generated_image(
    image_id: str,
    user: User = Depends(get_user_for_media),
    db: Session = Depends(get_db),
):
    record = db.query(GeneratedImage).filter(GeneratedImage.id == image_id).first()
    # Same 404 whether the image doesn't exist or belongs to someone else --
    # never confirm another user's image id exists.
    if not record or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="Image not found")

    abs_path = resolve_image_path(record.file_path)
    if not os.path.isfile(abs_path):
        logger.error(f"Generated image row {image_id} has no file on disk at {abs_path}")
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(abs_path, media_type="image/png")
