import logging
import os

from fastapi import APIRouter

logger = logging.getLogger("UploadRouter")
router = APIRouter(prefix="/api", tags=["upload"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_STORAGE_ROOT = os.path.join(os.getenv("DATA_DIR") or BACKEND_DIR, "uploads")
