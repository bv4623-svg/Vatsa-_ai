"""Keeps provider and model identity out of anything a user can see.

This is a safety net behind the real defence, which is that the router only
ever raises errors with fixed public messages. It exists for strings that come
from somewhere else and might still carry an upstream name.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

# Provider and model-family names. Deliberately specific: bare words such as
# "google" or "mini" are not here because they appear in ordinary user-facing
# text ("Sign in with Google").
_FAMILY_TERMS = (
    r"openrouter", r"openai", r"chatgpt", r"gpt[-_ ]?\d[\w.\-]*", r"o[134][-_]mini",
    r"anthropic", r"claude[\w.\-]*", r"sonnet", r"opus", r"haiku",
    r"gemini[\w.\-]*", r"gemma[\w.\-]*", r"deepseek[\w.\-]*",
    r"mistral[\w.\-]*", r"mixtral[\w.\-]*", r"llama[\w.\-]*", r"qwen[\w.\-]*",
    r"nvidia", r"nemotron[\w.\-]*", r"nex[-_]agi[\w.\-/:]*",
)
_FAMILY_RE = re.compile(r"(?<![A-Za-z0-9])(?:" + "|".join(_FAMILY_TERMS) + r")(?![A-Za-z0-9])", re.IGNORECASE)

REDACTED = "[redacted]"


def _extra_re(extra_terms: Iterable[str]) -> Optional[re.Pattern]:
    terms = sorted({t for t in extra_terms if t and len(t) >= 3}, key=len, reverse=True)
    if not terms:
        return None
    return re.compile("|".join(re.escape(t) for t in terms), re.IGNORECASE)


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
