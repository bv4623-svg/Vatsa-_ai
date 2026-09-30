"""Uploads for chat attachments: documents (PDF/DOCX/XLSX), text and code
files, and images (PNG/JPEG/GIF/WEBP, SVG).

Documents and text files are parsed into text the client sends with the chat
message (bounded: page, size and character caps; parsed off the event loop).
Images are stored with a thumbnail; the chat vision path sends their bytes to
the model. Every upload is kept in the user's Library through the shared
storage backend (local disk or S3/R2).
"""
from datetime import datetime, timezone
import io
import logging
import os
import uuid
import zipfile
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.account import notify_quota_warning
from app.services.library import check_quota, register_item
from app.services.storage import get_storage_backend
from app.utils.rate_limit import enforce_rate_limit

logger = logging.getLogger("UploadRouter")
router = APIRouter(prefix="/api", tags=["upload"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_STORAGE_ROOT = os.path.join(os.getenv("DATA_DIR") or BACKEND_DIR, "uploads")
# Shared across this app -- app/routers/library/{download,preview}.py and
# app/services/library/deletion.py import this same instance so an upload's
# read/delete path goes through the identical backend (local disk or S3/R2)
# its write path used, instead of each reaching into the local filesystem
# on its own and silently breaking the moment STORAGE_BACKEND=s3 is set.
upload_storage = get_storage_backend(UPLOAD_STORAGE_ROOT)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
# Text handed back to the client (and from there into the prompt). Past this
# the document is truncated and the response says so.
MAX_EXTRACTED_CHARS = 50_000
# A 2,000-page PDF would pin a worker for minutes; the first 300 pages are
# already far more text than MAX_EXTRACTED_CHARS.
MAX_PDF_PAGES = 300
# DOCX/XLSX are zip archives. Refuse ones that inflate beyond this before
# handing them to a parser (zip bombs).
MAX_UNCOMPRESSED_OFFICE_BYTES = 200 * 1024 * 1024
UPLOADS_PER_MINUTE = 30

SCANNED_PDF_WARNING = (
    "No selectable text found. This looks like a scanned or image-only PDF. "
    "Attach the pages as images instead so Vatsa AI can read them."
)
EMPTY_DOC_WARNING = "This file contains no readable text."


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


def thumbnail_key_for(storage_path: str) -> str:
    return f"{storage_path}.thumb.jpg"


# Real file-format signatures, checked against the actual bytes rather than
# trusting the extension a client claims -- a renamed .exe or script can't
# masquerade as one of these just by getting a matching filename. Not
# checked for text files or .svg (both are legitimately arbitrary text,
# with no fixed byte signature to check against).
_MAGIC_BYTES = {
    ".pdf": (b"%PDF-",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsm": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
}

TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".csv", ".json", ".log", ".py", ".js", ".jsx", ".ts", ".tsx",
    ".html", ".htm", ".css", ".scss", ".sass", ".xml", ".yaml", ".yml", ".sh", ".bash", ".zsh",
    ".sql", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".rb", ".php", ".kt",
    ".swift", ".dart", ".r", ".m", ".pl", ".lua", ".vue", ".svelte", ".tsv",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xlsm"}

_MIME_BY_EXT = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class ExtractionError(Exception):
    """A user-facing reason the file could not be read (safe to show)."""


def _check_magic_bytes(raw: bytes, ext: str) -> None:
    signatures = _MAGIC_BYTES.get(ext)
    if not signatures:
        return
    if not any(raw.startswith(sig) for sig in signatures):
        raise HTTPException(400, f"File content doesn't match its {ext} extension")


def _check_webp(raw: bytes) -> None:
    if not (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
        raise HTTPException(400, "File content doesn't match its .webp extension")


def _check_svg(raw: bytes) -> None:
    head = raw[:512].lstrip()
    if not (head.startswith(b"<?xml") or head.startswith(b"<svg")):
        raise HTTPException(400, "File content doesn't look like a valid SVG")


def _make_thumbnail(raw: bytes) -> Optional[bytes]:
    """A small JPEG preview for an uploaded image, or None if Pillow can't
    decode it (corrupt file, or a format Pillow doesn't support -- SVG is
    vector, not decoded here, so it never gets a raster thumbnail)."""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
        img.thumbnail((320, 320))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82)
        return buf.getvalue()
    except Exception:
        logger.warning("Thumbnail generation failed", exc_info=True)
        return None


def _check_zip_size(raw: bytes) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            total = sum(i.file_size for i in zf.infolist())
    except zipfile.BadZipFile:
        raise ExtractionError("This file is corrupted and could not be opened.")
    if total > MAX_UNCOMPRESSED_OFFICE_BYTES:
        raise ExtractionError("This file expands to more data than we can process.")


# Parsers are imported on first use, not at startup, to keep the process
# small on the 512 MB instance.

def _extract_pdf(raw: bytes) -> Tuple[str, Dict[str, Any]]:
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(500, "PDF support is not installed on the server.")
    parts, chars = [], 0
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            total_pages = len(pdf.pages)
            parsed = 0
            for page in pdf.pages[:MAX_PDF_PAGES]:
                text = page.extract_text() or ""
                parts.append(text)
                chars += len(text)
                parsed += 1
                page.flush_cache()
                if chars > MAX_EXTRACTED_CHARS:
                    break
    except Exception as e:
        # pdfplumber wraps pdfminer's errors (e.g. PDFPasswordIncorrect) in
        # a generic PdfminerException, so look at the wrapped ones too.
        chain = [e, *[a for a in e.args if isinstance(a, BaseException)], e.__cause__, e.__context__]
        names = " ".join(type(x).__name__ for x in chain if x is not None)
        logger.warning(f"pdfplumber failed: {names}: {e}")
        if "Password" in names or "Encrypt" in names:
            raise ExtractionError("This PDF is password-protected. Remove the password and try again.")
        raise ExtractionError("This PDF is corrupted or not a valid PDF.")
    return "\n".join(parts), {"pages": total_pages, "pages_parsed": parsed}


def _extract_docx(raw: bytes) -> Tuple[str, Dict[str, Any]]:
    try:
        import docx as _docx
    except ImportError:
        raise HTTPException(500, "DOCX support is not installed on the server.")
    _check_zip_size(raw)
    try:
        doc = _docx.Document(io.BytesIO(raw))
    except Exception as e:
        logger.warning(f"python-docx failed: {type(e).__name__}: {e}")
        raise ExtractionError("This Word document is corrupted or not a valid .docx file.")
    parts = [p.text for p in doc.paragraphs if p.text]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts), {}


def _extract_xlsx(raw: bytes) -> Tuple[str, Dict[str, Any]]:
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "Excel support is not installed on the server.")
    _check_zip_size(raw)
    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
    except Exception as e:
        logger.warning(f"openpyxl failed: {type(e).__name__}: {e}")
        raise ExtractionError("This spreadsheet is corrupted or not a valid Excel file.")
    parts, chars = [], 0
    try:
        for sheet in wb.worksheets:
            parts.append(f"--- Sheet: {sheet.title} ---")
            for row in sheet.iter_rows(values_only=True):
                if any(cell is not None for cell in row):
                    line = ", ".join("" if c is None else str(c) for c in row)
                    parts.append(line)
                    chars += len(line)
                    # Stop reading a million-row sheet once there is more
                    # than we will return anyway.
                    if chars > MAX_EXTRACTED_CHARS:
                        return "\n".join(parts), {"sheets": len(wb.worksheets)}
        return "\n".join(parts), {"sheets": len(wb.worksheets)}
    finally:
        wb.close()


def extract_text_from_bytes(raw: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
    """Returns (text, metadata) for a document or text file. Raises
    HTTPException for unsupported types and ExtractionError for files that
    are the right type but unreadable. CPU-bound -- call through
    run_in_threadpool from async code."""
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf":
        return _extract_pdf(raw)
    if ext == ".docx":
        return _extract_docx(raw)
    if ext in (".xlsx", ".xlsm"):
        return _extract_xlsx(raw)
    if ext in TEXT_EXTENSIONS:
        # utf-8-sig drops a BOM that would otherwise show up as a stray glyph.
        return raw.decode("utf-8-sig", errors="replace"), {}
    raise HTTPException(400, f"Unsupported file type: {filename}. Supported: PDF, DOCX, XLSX, text/code files and images.")


async def _read_capped(file: UploadFile) -> bytes:
    buf = bytearray()
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File too large (max 25 MB).")
    return bytes(buf)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"upload:{current_user.id}", UPLOADS_PER_MINUTE, 60)
    raw = await _read_capped(file)
    if not raw:
        raise HTTPException(400, "File is empty.")

    filename = sanitize_filename(file.filename or "file")
    ext = os.path.splitext(filename)[1].lower()

    is_image = ext in IMAGE_EXTENSIONS
    is_svg = ext == ".svg"
    is_text = ext in TEXT_EXTENSIONS
    is_document = ext in DOCUMENT_EXTENSIONS

    if not (is_image or is_svg or is_text or is_document):
        raise HTTPException(400, f"Unsupported file type: {filename}. Supported: PDF, DOCX, XLSX, text/code files and images.")

    if ext == ".webp":
        _check_webp(raw)
    elif is_svg:
        _check_svg(raw)
    else:
        _check_magic_bytes(raw, ext)

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

    # Images/SVG get no text: the chat vision path sends the image itself.
    text, meta = "", {}
    if is_document or is_text:
        try:
            # Parsing is CPU-bound and synchronous; on the event loop it would
            # stall every other request for as long as a large PDF takes.
            text, meta = await run_in_threadpool(extract_text_from_bytes, raw, filename)
        except HTTPException:
            raise
        except ExtractionError as e:
            raise HTTPException(422, str(e))
        except Exception:
            logger.exception("Unexpected extraction failure for %s", filename)
            raise HTTPException(422, "Could not read this file.")

    text = (text or "").strip()
    truncated = len(text) > MAX_EXTRACTED_CHARS or (
        meta.get("pages_parsed") is not None and meta["pages_parsed"] < meta.get("pages", 0)
    )
    text = text[:MAX_EXTRACTED_CHARS]

    warning: Optional[str] = None
    if (is_document or is_text) and not text:
        warning = SCANNED_PDF_WARNING if ext == ".pdf" else EMPTY_DOC_WARNING

    file_id = str(uuid.uuid4())
    mime_type = file.content_type or _MIME_BY_EXT.get(ext, "application/octet-stream")
    storage_path = os.path.join(str(current_user.id), f"{file_id}_{filename}")
    try:
        upload_storage.put(storage_path, raw)
    except Exception:
        logger.exception("Storage write failed for upload %s", file_id)
        raise HTTPException(502, "Could not save the uploaded file. Please try again.")

    thumbnail_persisted = False
    if is_image:
        thumb = _make_thumbnail(raw)
        if thumb:
            try:
                upload_storage.put(thumbnail_key_for(storage_path), thumb)
                thumbnail_persisted = True
            except Exception:
                logger.warning("Thumbnail write failed for upload %s", file_id, exc_info=True)

    item = register_item(
        db, current_user.id, "upload", name=filename, size_bytes=len(raw),
        mime=mime_type, source_table="uploads", source_id=file_id,
        storage_path=storage_path,
    )

    return {
        "id": item.id,
        "file_id": file_id,  # back-compat with earlier callers keyed on file_id
        "filename": filename,
        "size": len(raw),
        "size_bytes": len(raw),  # back-compat
        "mime_type": mime_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "url": f"/api/library/items/{item.id}/download",
        "thumbnail_url": f"/api/library/items/{item.id}/thumbnail" if thumbnail_persisted else None,
        "chars": len(text),
        "text": text,
        "truncated": truncated,
        "warning": warning,
        **{k: v for k, v in meta.items() if k in ("pages", "pages_parsed", "sheets")},
    }
