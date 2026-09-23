from fastapi import HTTPException


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
