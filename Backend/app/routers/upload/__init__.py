"""File upload: filename sanitization, magic-byte-verified text extraction
(PDF/DOCX/XLSX/plaintext), storage-quota enforcement and Library
registration.

Split into router.py (shared APIRouter + BACKEND_DIR/UPLOAD_STORAGE_ROOT),
sanitize.py, extractors.py and endpoint.py. Every previously-public name
is re-exported here so `app.routers.upload.router` (app/main.py) and
`from app.routers.upload import UPLOAD_STORAGE_ROOT`
(app/routers/library/storage_roots.py) keep working unchanged.
"""
from app.routers.upload.router import router, logger, BACKEND_DIR, UPLOAD_STORAGE_ROOT
from app.routers.upload.sanitize import sanitize_filename, _check_magic_bytes, _MAGIC_BYTES
from app.routers.upload.extractors import (
    extract_text_from_bytes, PDF_SUPPORT, DOCX_SUPPORT, XLSX_SUPPORT,
)
from app.routers.upload.endpoint import upload_file, FILE_STORE

__all__ = [
    "router", "logger", "BACKEND_DIR", "UPLOAD_STORAGE_ROOT",
    "sanitize_filename", "_MAGIC_BYTES", "_check_magic_bytes",
    "extract_text_from_bytes", "PDF_SUPPORT", "DOCX_SUPPORT", "XLSX_SUPPORT",
    "upload_file", "FILE_STORE",
]
