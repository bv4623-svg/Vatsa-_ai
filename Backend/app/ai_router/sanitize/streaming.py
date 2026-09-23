"""Identity redaction across a stream of small chunks instead of one whole
string -- see the class docstring for why that needs different logic than
redact_identity() alone."""
from __future__ import annotations

import re
from typing import Iterable

from app.ai_router.sanitize.redact import redact_identity


class StreamingRedactor:
    """redact_identity(), applied across a stream of small chunks instead of
    one whole string.

    A provider can split its output into chunks anywhere -- including in the
    middle of a multi-word pattern like "Google's Gemini" (see _FAMILY_TERMS
    in patterns.py). Redacting each chunk independently, as the router used
    to, would miss that: the compound pattern needs both chunks at once to
    match. This holds back the last `hold_back_words` whitespace-separated
    words instead of emitting them immediately, so a match spanning a chunk
    boundary is still complete by the time it's checked, then releases them
    once enough new text has arrived. Call flush() once the stream ends to
    release whatever is still held back.

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
