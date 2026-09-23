"""Response/error parsing for OpenRouter's chat/completions API -- kept
separate from the transport code in adapter.py."""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.ai_router.errors import ErrorKind, ProviderError
from app.ai_router.types import Usage

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


def classify_status(status: int) -> ErrorKind:
    if status == 429:
        return ErrorKind.RATE_LIMITED
    if status in (408, 504, 524):
        return ErrorKind.TIMEOUT
    if 500 <= status <= 599:
        return ErrorKind.SERVER_ERROR
    if status in (401, 402, 403):  # bad key, no credit, or blocked: not fixable by retrying
        return ErrorKind.AUTH
    if status == 404:
        return ErrorKind.NOT_FOUND
    if status in (400, 422):
        return ErrorKind.BAD_REQUEST
    return ErrorKind.UNKNOWN


def _retry_after(headers: Any) -> Optional[float]:
    try:
        value = headers.get("Retry-After")
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None  # an HTTP-date form is ignored: we fall back to our own backoff


def _usage(raw: Optional[Dict[str, Any]]) -> Optional[Usage]:
    if not raw:
        return None
    return Usage(int(raw.get("prompt_tokens") or 0), int(raw.get("completion_tokens") or 0))


def _in_band_error(data: Dict[str, Any]) -> Optional[ProviderError]:
    """OpenRouter can answer HTTP 200 with an error object when the upstream
    model failed after the request was accepted."""
    err = data.get("error")
    if not err:
        return None
    code = err.get("code") if isinstance(err, dict) else None
    kind = classify_status(int(code)) if isinstance(code, int) else ErrorKind.SERVER_ERROR
    return ProviderError(kind, status=code if isinstance(code, int) else None, detail=str(err)[:500])
