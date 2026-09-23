"""Provider/model-family regex patterns and the neutral marker they get
replaced with."""
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
