"""Document upload + text extraction for chat attachments.

The client uploads a PDF/DOCX/XLSX (or a plain-text file), gets the
extracted text back, and sends that text with the chat message. The raw
bytes are also kept in the user's Library.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from typing import Optional, Tuple, Dict, Any
import uuid
import io
import os
import logging
import zipfile
from sqlalchemy.orm import Session
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.library import register_item, check_quota
from app.services.account import notify_quota_warning
from app.utils.rate_limit import enforce_rate_limit

logger = logging.getLogger("UploadRouter")
router = APIRouter(prefix="/api", tags=["upload"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_STORAGE_ROOT = os.path.join(os.getenv("DATA_DIR") or BACKEND_DIR, "uploads")

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

TEXT_EXTENSIONS = (
    ".txt", ".md", ".csv", ".json", ".log", ".py", ".js", ".ts", ".html", ".css",
    ".jsx", ".tsx", ".yaml", ".yml", ".xml", ".tsv", ".sql", ".sh",
)


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

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    import docx as _docx
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False

try:
    import openpyxl
    XLSX_SUPPORT = True
except ImportError:
    XLSX_SUPPORT = False

# Real file-format signatures, checked against the actual bytes rather than
# trusting the extension a client claims -- a renamed .exe or script can't
# masquerade as one of these just by getting a matching filename.
_MAGIC_BYTES = {
    ".pdf": (b"%PDF-",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsm": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
}


class ExtractionError(Exception):
    """A user-facing reason the file could not be read (safe to show)."""


def _check_magic_bytes(raw: bytes, filename: str) -> None:
    lower = filename.lower()
    for ext, signatures in _MAGIC_BYTES.items():
        if lower.endswith(ext):
            if not any(raw.startswith(sig) for sig in signatures):
                raise HTTPException(400, f"File content doesn't match its {ext} extension")
            return


def _check_zip_size(raw: bytes) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            total = sum(i.file_size for i in zf.infolist())
    except zipfile.BadZipFile:
        raise ExtractionError("This file is corrupted and could not be opened.")
    if total > MAX_UNCOMPRESSED_OFFICE_BYTES:
        raise ExtractionError("This file expands to more data than we can process.")


def _extract_pdf(raw: bytes) -> Tuple[str, Dict[str, Any]]:
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
    """Returns (text, metadata). Raises HTTPException for unsupported types
    and ExtractionError for files that are the right type but unreadable.
    CPU-bound -- call through run_in_threadpool from async code."""
    _check_magic_bytes(raw, filename)
    lower = filename.lower()
    if lower.endswith(".pdf"):
        if not PDF_SUPPORT:
            raise HTTPException(500, "PDF support is not installed on the server.")
        return _extract_pdf(raw)
    if lower.endswith(".docx"):
        if not DOCX_SUPPORT:
            raise HTTPException(500, "DOCX support is not installed on the server.")
        return _extract_docx(raw)
    if lower.endswith((".xlsx", ".xlsm")):
        if not XLSX_SUPPORT:
            raise HTTPException(500, "Excel support is not installed on the server.")
        return _extract_xlsx(raw)
    if lower.endswith(TEXT_EXTENSIONS):
        # utf-8-sig drops a BOM that would otherwise show up as a stray glyph.
        return raw.decode("utf-8-sig", errors="replace"), {}
    raise HTTPException(400, f"Unsupported file type: {filename}. Supported: PDF, DOCX, XLSX and text/code files.")


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
    if not text:
        warning = SCANNED_PDF_WARNING if filename.lower().endswith(".pdf") else EMPTY_DOC_WARNING

    file_id = str(uuid.uuid4())
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
        "text": text,
        "truncated": truncated,
        "warning": warning,
        **{k: v for k, v in meta.items() if k in ("pages", "pages_parsed", "sheets")},
    }
