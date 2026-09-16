"""
Conservative, regex-only extraction of self-stated facts from a user's
chat message. No LLM call here on purpose: keeps this at zero extra
cost/latency and never introduces a second model name into logs.

Only ever call this on USER messages, never assistant output.
"""
import re
from typing import List, Dict, Any, Optional

# --- Safety: never extract anything from a message that looks like it
# contains a credential/secret, regardless of what else it says. ---
_SENSITIVE_PATTERNS = [
    r"\bpassword\b", r"\bpasswd\b", r"\bpass\s*word\b",
    r"\bapi[\s_-]?key\b", r"\bsecret\s*key\b", r"\baccess\s*token\b",
    r"\bbearer\s+[a-z0-9._-]{10,}", r"\botp\b", r"\bcvv\b", r"\bpin\s*(is|:)\b",
    r"\bupi\s*id\b", r"\b[a-z0-9.]{2,}@(ok|ybl|paytm|apl|ibl|axl)\b",
    r"\b\d{13,19}\b",  # card-number-length digit runs
    r"\bssn\b", r"\bsocial security\b",
]
_SENSITIVE_RE = re.compile("|".join(_SENSITIVE_PATTERNS), re.IGNORECASE)

_HYPOTHETICAL_RE = re.compile(
    r"\b(if i (had|were|was)|imagine if|suppose i|hypothetically|what if i)\b",
    re.IGNORECASE,
)

_GREETING_FILLER = {
    "hi", "hello", "hey", "yo", "sup", "thanks", "thank you", "thx",
    "ok", "okay", "k", "yes", "no", "yep", "nope", "sure", "cool",
    "nice", "great", "good", "fine", "bye", "goodbye", "lol", "haha",
}

# Common non-name words that follow "I'm"/"I am" and should never be
# mistaken for a name.
_NOT_A_NAME = {
    "building", "working", "trying", "looking", "going", "doing",
    "feeling", "currently", "still", "just", "also", "really", "very",
    "here", "back", "new", "sorry", "glad", "sure", "fine", "okay",
    "ready", "not", "a", "an", "the", "so", "happy", "sad", "tired",
    "excited", "interested", "learning", "studying", "using", "on",
    "in", "from", "about", "into", "done", "confused", "stuck",
}

_NAME_WORD = r"[A-Z][a-zA-Z'\-]{1,30}"


def _looks_sensitive(text: str) -> bool:
    return bool(_SENSITIVE_RE.search(text))


def _looks_hypothetical(text: str) -> bool:
    return bool(_HYPOTHETICAL_RE.search(text))


def _looks_like_filler(text: str) -> bool:
    stripped = text.strip().strip(".!").lower()
    return stripped in _GREETING_FILLER or len(stripped) < 3


def _slug(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return s[:40] or "value"


def _clean_value(value: str) -> str:
    value = value.strip().strip(".,!?;:\"'")
    # Cut off at the first clause boundary so we don't capture a whole
    # trailing sentence as the value.
    value = re.split(r"[.!?\n]|,\s+(?:and|but|so|because)\b", value, maxsplit=1)[0]
    return value.strip()


def extract_facts(user_message: str) -> List[Dict[str, Any]]:
    """
    Returns a list of {type, category, content, confidence} dicts.
    type: "identity" | "preference" | "project" | "fact"
    Only high-confidence, self-stated facts. Returns [] when nothing
    meaningful (or something unsafe) is found.
    """
    if not user_message or not user_message.strip():
        return []
    text = user_message.strip()

    if _looks_sensitive(text):
        return []
    if _looks_hypothetical(text):
        return []
    if _looks_like_filler(text):
        return []
    # A pure question ("what's my favorite color?") is the user asking
    # to be told something, not stating a new fact -- skip unless it
    # also contains a clear self-statement elsewhere in the message.
    is_question = text.rstrip().endswith("?")

    facts: List[Dict[str, Any]] = []

    # --- identity: name ---
    m = re.search(r"\bmy name is\s+(" + _NAME_WORD + r"(?:\s+" + _NAME_WORD + r"){0,2})", text, re.IGNORECASE)
    if not m:
        m = re.search(r"\bcall me\s+(" + _NAME_WORD + r")\b", text, re.IGNORECASE)
    if not m and not is_question:
        cand = re.search(r"\bi'?m\s+(" + _NAME_WORD + r"(?:\s+" + _NAME_WORD + r"){0,2})\b", text, re.IGNORECASE)
        if cand and cand.group(1).split()[0].lower() not in _NOT_A_NAME:
            m = cand
    if m:
        name = _clean_value(m.group(1)).title()
        if name and name.lower() not in _NOT_A_NAME:
            facts.append({
                "type": "identity",
                "category": "name",
                "content": f"name: {name}",
                "confidence": 0.9,
            })

    if not is_question:
        # --- project: "I'm building X" / "I work on X" / "my project is X" ---
        m = re.search(
            r"\b(?:i'?m building|i am building|i work on|i'?m working on|my project is)\s+(.{2,80})",
            text, re.IGNORECASE,
        )
        if m:
            proj = _clean_value(m.group(1))
            if proj:
                facts.append({
                    "type": "project",
                    "category": f"project_{_slug(proj)}",
                    "content": f"building: {proj}",
                    "confidence": 0.85,
                })

        # --- fact: location ---
        m = re.search(r"\bi live in\s+(.{2,50})", text, re.IGNORECASE)
        if not m:
            m = re.search(r"\bi'?m from\s+(.{2,50})", text, re.IGNORECASE)
        if m:
            loc = _clean_value(m.group(1))
            if loc:
                facts.append({
                    "type": "fact",
                    "category": "location",
                    "content": f"location: {loc}",
                    "confidence": 0.85,
                })

        # --- preference: "my favorite X is Y" ---
        for m in re.finditer(
            r"\bmy favorite\s+([a-z ]{2,20}?)\s+is\s+(.{1,50})",
            text, re.IGNORECASE,
        ):
            key = _slug(m.group(1))
            val = _clean_value(m.group(2))
            if key and val:
                facts.append({
                    "type": "preference",
                    "category": f"favorite_{key}",
                    "content": f"favorite {m.group(1).strip().lower()}: {val}",
                    "confidence": 0.9,
                })

        # --- preference: "I like/love X" ---
        for m in re.finditer(
            r"\bi\s+(?:really\s+)?(?:like|love)\s+(.{2,50})",
            text, re.IGNORECASE,
        ):
            val = _clean_value(m.group(1))
            if val and len(val) > 1:
                facts.append({
                    "type": "preference",
                    "category": f"likes_{_slug(val)}",
                    "content": f"likes: {val}",
                    "confidence": 0.7,
                })

        # --- preference: "I use X" / "I prefer X" ---
        for m in re.finditer(
            r"\bi\s+(?:prefer|use)\s+(.{2,50})",
            text, re.IGNORECASE,
        ):
            val = _clean_value(m.group(1))
            if val and len(val) > 1:
                facts.append({
                    "type": "preference",
                    "category": f"prefers_{_slug(val)}",
                    "content": f"prefers: {val}",
                    "confidence": 0.7,
                })

    return facts
