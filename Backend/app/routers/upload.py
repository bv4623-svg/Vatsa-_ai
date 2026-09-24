from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Optional
import uuid
import io
import os
import logging
from sqlalchemy.orm import Session
from app.auth.dependencies import get_current_user_optional
from app.database import get_db
from app.models.user import User
from app.services.library import register_item, check_quota
from app.services.account import notify_quota_warning
from app.services.storage import get_storage_backend

logger = logging.getLogger("UploadRouter")
router = APIRouter(prefix="/api", tags=["upload"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_STORAGE_ROOT = os.path.join(os.getenv("DATA_DIR") or BACKEND_DIR, "uploads")
_storage = get_storage_backend(UPLOAD_STORAGE_ROOT)


def sanitize_filename(raw: str) -> str:
    """A client-supplied filename must never become a path component as-is
    -- "../../../etc/passwd" or an absolute path ("C:\\Windows\\...") would
    otherwise let an upload write (and later read back) files outside
    UPLOAD_STORAGE_ROOT. Strips directory separators from both OS
    conventions (this runs on Windows dev machines too) and NUL bytes,
    keeps only the final path segment, and falls back to a safe default
    if nothing usable is left."""
    name = (raw or "").replace("\x00", "")
    name = name.replace("\\", "/").split("/")[-1].strip()
    name = name.lstrip(".") or "file"
    return name[:255]

FILE_STORE = {}

# Real file-format signatures, checked against the actual bytes rather than
# trusting the extension a client claims -- a renamed .exe or script can't
# masquerade as one of these just by getting a matching filename.
_MAGIC_BYTES = {
    ".pdf": (b"%PDF-",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsm": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
}


def _check_magic_bytes(raw: bytes, filename: str) -> None:
    lower = filename.lower()
    for ext, signatures in _MAGIC_BYTES.items():
        if lower.endswith(ext):
            if not any(raw.startswith(sig) for sig in signatures):
                raise HTTPException(400, f"File content doesn't match its {ext} extension")
            return


def extract_text_from_bytes(raw: bytes, filename: str) -> str:
    _check_magic_bytes(raw, filename)
    lower = filename.lower()
    if lower.endswith(".pdf"):
        try:
            import pdfplumber
        except ImportError:
            raise HTTPException(500, "PDF support not installed. Run: pip install pdfplumber")
        text = ""
        try:
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        except Exception as e:
            logger.error(f"pdfplumber failed on {filename}: {e}")
        return text

    if lower.endswith(".docx"):
        try:
            import docx as _docx
        except ImportError:
            raise HTTPException(500, "DOCX support not installed. Run: pip install python-docx")
        try:
            doc = _docx.Document(io.BytesIO(raw))
            parts = [p.text for p in doc.paragraphs if p.text]
            for table in doc.tables:
                for row in table.rows:
                    parts.append(" | ".join(cell.text for cell in row.cells))
            return "\n".join(parts)
        except Exception as e:
            logger.error(f"python-docx failed on {filename}: {e}")
            return ""

    if lower.endswith((".xlsx", ".xlsm")):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(500, "Excel support not installed. Run: pip install openpyxl")
        try:
            wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
            parts = []
            for sheet in wb.worksheets:
                parts.append(f"--- Sheet: {sheet.title} ---")
                for row in sheet.iter_rows(values_only=True):
                    if any(cell is not None for cell in row):
                        parts.append(", ".join("" if c is None else str(c) for c in row))
            return "\n".join(parts)
        except Exception as e:
            logger.error(f"openpyxl failed on {filename}: {e}")
            return ""

    if lower.endswith((".txt", ".md", ".csv", ".json", ".log", ".py", ".js", ".ts", ".html", ".css", ".jsx", ".tsx", ".yaml", ".yml")):
        return raw.decode("utf-8", errors="ignore")

    raise HTTPException(400, f"Unsupported file type: {filename}")

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
            storage_path = os.path.join(str(current_user.id), f"{file_id}_{filename}")
            _storage.put(storage_path, raw)

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
