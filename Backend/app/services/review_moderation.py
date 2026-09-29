"""Checks that run on every review before it is stored.

Heuristic, not model-based: it needs no API key, is deterministic, and is
unit-tested. An LLM check can be layered on top later without changing
callers (they only see the verdict)."""
import math
import re
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

# Abuse aimed at people, in English and romanized Hindi. Mild profanity
# ("damn", "hell") is deliberately absent: it isn't a reason to reject.
_TOXIC_PATTERNS = [
    r"f+u+c+k+\s*(?:you|u|off|this\s+(?:guy|team|dev))",
    r"motherf+u+c+k", r"\bbitch(?:es)?\b", r"\bbastards?\b", r"\bretard(?:ed|s)?\b",
    r"\bwhore\b", r"\bslut\b", r"\bcunt\b", r"\bn[i1]gg(?:er|a)s?\b", r"\bfaggots?\b",
    r"\bkill\s+yourself\b", r"\bkys\b", r"\bgo\s+die\b",
    r"\bchut(?:i|iy)a\w*", r"\bmadar\s*chod\w*", r"\bbhen\s*chod\w*", r"\bbehen\s*chod\w*",
    r"\bmc\s+bc\b", r"\bharam(?:i|zade|zada)\b", r"\bgaandu\b",
]
_TOXIC_RE = re.compile("|".join(_TOXIC_PATTERNS), re.I)

_URL_RE = re.compile(r"https?://|www\.", re.I)
# Case-sensitive on purpose: "great tool.In the end" is a missing space, not a link.
_DOMAIN_RE = re.compile(r"\b[\w-]+\.(?:com|net|org|io|in|xyz|ru|shop|link|biz)\b")
_CONTACT_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\s-]?){10,}")
_PROMO_RE = re.compile(
    r"\b(?:discount|coupon|promo\s*code|buy\s+now|click\s+here|limited\s+offer|free\s+money|earn\s+\$?\d+|"
    r"whatsapp\s+me|dm\s+me|telegram\s+me|follow\s+me|subscribe\s+to\s+my|check\s+out\s+my|visit\s+my)\b",
    re.I,
)
_REPEAT_RE = re.compile(r"(.)\1{5,}")

_POSITIVE = {
    "love", "great", "excellent", "amazing", "awesome", "fast", "helpful", "accurate", "best", "easy",
    "perfect", "fantastic", "useful", "reliable", "impressive", "smooth", "brilliant", "good", "nice", "worth",
}
_NEGATIVE = {
    "bad", "slow", "wrong", "useless", "terrible", "awful", "broken", "bug", "buggy", "crash", "crashes",
    "expensive", "hate", "worst", "poor", "confusing", "hallucinates", "inaccurate", "annoying", "disappointed",
}
# Whole-word patterns: plain substrings mis-tag ("ui" is inside "quick").
_TAG_PATTERNS = {
    tag: re.compile(r"\b(?:" + pattern + r")\b", re.I)
    for tag, pattern in {
        "quality": r"accura\w*|quality|correct\w*|wrong|hallucinat\w*|smart\w*|answers?",
        "speed": r"fast\w*|slow\w*|quick\w*|speed\w*|latency|instant\w*|lag|laggy",
        "price": r"pric\w*|costs?|costly|expensive|cheap\w*|worth\w*|value|plans?|subscriptions?|free tier",
        "support": r"customer support|support team|support staff|customer service|help desk|refunds?",
        "coding": r"code|coding|coder|programm\w*|debug\w*|python|javascript|typescript|developers?",
        "images": r"images?|pictures?|photos?|drawings?|artwork|illustrations?",
        "research": r"research\w*|sources?|citations?|web search",
        "ui": r"interface|design\w*|ui|ux|easy to use|layout|dark mode",
    }.items()
}

SPAM_REJECT_AT = 0.7
SPAM_QUEUE_AT = 0.3


@dataclass
class Verdict:
    status: str                      # "approved" | "pending" | "rejected"
    spam_score: float
    sentiment: str
    tags: List[str] = field(default_factory=list)
    note: Optional[str] = None       # shown to the author when not approved


def find_toxic(text: str) -> Optional[str]:
    match = _TOXIC_RE.search(text or "")
    return match.group(0) if match else None


def spam_score(text: str, *, duplicate: bool = False) -> float:
    text = text or ""
    score = 0.0
    score += min(len(_URL_RE.findall(text)) + len(_DOMAIN_RE.findall(text)), 2) * 0.35
    if _CONTACT_RE.search(text):
        score += 0.3
    score += min(len(_PROMO_RE.findall(text)), 2) * 0.25
    letters = [c for c in text if c.isalpha()]
    if len(letters) >= 20 and sum(c.isupper() for c in letters) / len(letters) > 0.6:
        score += 0.2
    if _REPEAT_RE.search(text):
        score += 0.1
    if duplicate:
        score += 0.6
    return round(min(score, 1.0), 2)


def sentiment(rating: int, text: str) -> str:
    words = re.findall(r"[a-z']+", (text or "").lower())
    lexical = sum(w in _POSITIVE for w in words) - sum(w in _NEGATIVE for w in words)
    score = (rating - 3) / 2 + max(-1.0, min(1.0, lexical / 4)) * 0.5
    if score > 0.25:
        return "positive"
    if score < -0.25:
        return "negative"
    return "neutral"


def auto_tags(text: str, chosen: Iterable[str] = ()) -> List[str]:
    tags = list(dict.fromkeys(chosen))
    for tag, pattern in _TAG_PATTERNS.items():
        if tag not in tags and pattern.search(text or ""):
            tags.append(tag)
    return tags[:5]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def wilson_lower_bound(helpful: int, not_helpful: int, z: float = 1.96) -> float:
    """"Most helpful" ranking: a review with 40 helpful / 2 not beats one with
    1 / 0, which a plain ratio would rank higher."""
    n = helpful + not_helpful
    if n == 0:
        return 0.0
    p = helpful / n
    return (p + z * z / (2 * n) - z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n)


def moderate(*, rating: int, text: str, chosen_tags: Iterable[str], duplicate: bool, trusted: bool) -> Verdict:
    """PRD 6.6: toxic -> rejected; clearly spam -> rejected; possible spam or
    an untrusted author -> moderation queue; trusted author -> published."""
    tags = auto_tags(text, chosen_tags)
    mood = sentiment(rating, text)
    if find_toxic(text):
        return Verdict("rejected", 0.0, mood, tags, "Your review contains abusive language, so it wasn't published.")
    score = spam_score(text, duplicate=duplicate)
    if score >= SPAM_REJECT_AT:
        return Verdict("rejected", score, mood, tags, "Your review looks like spam (links, contact details or repeated text), so it wasn't published.")
    if score >= SPAM_QUEUE_AT or not trusted:
        return Verdict("pending", score, mood, tags, None)
    return Verdict("approved", score, mood, tags, None)
