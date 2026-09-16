from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Optional
import uuid
import io
import logging
from app.auth.dependencies import get_current_user_optional
from app.models.user import User

logger = logging.getLogger("UploadRouter")
router = APIRouter(prefix="/api", tags=["upload"])

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

FILE_STORE = {}

def extract_text_from_bytes(raw: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        if not PDF_SUPPORT:
            raise HTTPException(500, "PDF support not installed. Run: pip install pdfplumber")
        text = ""
        try:
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        except Exception as e:
            logger.error(f"pdfplumber failed on {filename}: {e}")
        return text

    if lower.endswith(".docx"):
        if not DOCX_SUPPORT:
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
        if not XLSX_SUPPORT:
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
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 25MB)")

    filename = file.filename or "file"
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

    return {
        "file_id": file_id,
        "filename": filename,
        "chars": len(text),
        "size_bytes": len(raw),
        "text": text
    }
