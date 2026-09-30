"""Keeps provider and model identity out of anything a user can see.

This is a safety net behind the real defence, which is that the router only
ever raises errors with fixed public messages. It exists for strings that come
from somewhere else and might still carry an upstream name.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

# Provider and model-family names. Deliberately specific: bare words such as
# "google" or "mini" are not here on their own because they appear in
# ordinary user-facing text ("Sign in with Google") -- but "Google" paired
# with an AI-specific word ("Google's Gemini", "Google AI") is unambiguous,
# so that compound form IS matched (and matched as one span, before the
# standalone "gemini" pattern below would otherwise leave "Google" sitting
# right next to a redacted word -- see tests/test_confidentiality_end_to_end.py).
_FAMILY_TERMS = (
    r"google(?:'s)?\s+(?:ai\b|gemini[\w.\-]*|deepmind|bard|vertex\s*ai|cloud\s*ai)",
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


class StreamingRedactor:
    """redact_identity(), applied across a stream of small chunks instead of
    one whole string.

    A provider can split its output into chunks anywhere -- including in the
    middle of a multi-word pattern like "Google's Gemini" (see _FAMILY_TERMS).
    Redacting each chunk independently, as the router used to, would miss
    that: the compound pattern needs both chunks at once to match. This holds
    back the last `hold_back_words` whitespace-separated words instead of
    emitting them immediately, so a match spanning a chunk boundary is still
    complete by the time it's checked, then releases them once enough new
    text has arrived. Call flush() once the stream ends to release whatever
    is still held back.

    This raises confidence, but -- like redact_identity itself -- it is a
    backstop, not a guarantee: a leak phrased across more than
    `hold_back_words` words, or one that doesn't match any pattern in
    _FAMILY_TERMS at all, can still get through. The real defense is the
    system prompt instructing the model never to say this in the first
    place (see ai_service.py's IDENTITY_SEAL).
    """

    def __init__(self, extra_terms: Iterable[str] = (), hold_back_words: int = 6) -> None:
        self._extra_terms = tuple(t for t in extra_terms if t)
        self._hold_back_words = hold_back_words
        self._pending = ""

    def feed(self, chunk: str) -> str:
        if not chunk:
            return ""
        self._pending += chunk
        tokens = list(re.finditer(r"\S+", self._pending))
        if len(tokens) <= self._hold_back_words:
            return ""
        cut_at = tokens[-self._hold_back_words].start()
        if cut_at <= 0:
            return ""
        commit, self._pending = self._pending[:cut_at], self._pending[cut_at:]
        return redact_identity(commit, self._extra_terms)

    def flush(self) -> str:
        out = redact_identity(self._pending, self._extra_terms) if self._pending else ""
        self._pending = ""
        return out
