import logging

from fastapi import APIRouter

logger = logging.getLogger("VisionRouter")
router = APIRouter(prefix="/api/vision", tags=["vision"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
