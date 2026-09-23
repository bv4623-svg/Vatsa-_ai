"""Whole-string identity redaction. See app.ai_router.sanitize (package
docstring) for what this is a backstop for."""
from __future__ import annotations

from typing import Iterable

from app.ai_router.sanitize.patterns import _FAMILY_RE, REDACTED, _extra_re


def contains_identity(text: str, extra_terms: Iterable[str] = ()) -> bool:
    if not text:
        return False
    if _FAMILY_RE.search(text):
        return True
    extra = _extra_re(extra_terms)
    return bool(extra and extra.search(text))


def redact_identity(text: str, extra_terms: Iterable[str] = ()) -> str:
    """Replaces provider/model names (and any registry-specific ids passed in
    `extra_terms`) with a neutral marker."""
    if not text:
        return text
    extra = _extra_re(extra_terms)
    if extra:
        text = extra.sub(REDACTED, text)
    return _FAMILY_RE.sub(REDACTED, text)
