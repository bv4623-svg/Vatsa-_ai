"""Redacts sensitive values out of every log record before it reaches a
handler, so a stray `logger.info(f"...{token}...")` can't put a real
credential into stdout/a log file/an aggregator.

Attaching a `logging.Filter` to the ROOT LOGGER object only covers records
logged directly via `logging.getLogger()` (root itself) -- Python's logging
module checks a record's origin logger's own filters, not its ancestors',
before walking up to call each ancestor's HANDLERS (see `logging.Logger.
handle` / `logging.Handler.handle` in the stdlib). Since every logger in
this codebase is named (`logging.getLogger("ChatRouter")` etc.), a filter
that is only on the root Logger object would silently do nothing for real
traffic. `install()` below attaches the filter everywhere a record could
actually be emitted from today: the root logger's own filter list (per the
letter of "attach it to the root logger"), any handler already on the root
logger, and `logging.lastResort` (the stdlib's fallback stderr handler that
is what actually prints output today, since nothing in this app currently
calls `logging.basicConfig()` / adds a handler). If a real handler is added
later (e.g. structured JSON logging in production), attach this filter to
it too -- see install()'s docstring.
"""
import logging
import re

REDACTED = "***REDACTED***"

_SENSITIVE_KEYS = (
    "password", "token", "secret", "otp", "authorization",
    "api_key", "apikey", "jwt", "session", "cookie", "bearer",
)

# key: value / key=value / "key": "value", key matched case-insensitively,
# value read up to the next quote/comma/brace/whitespace run.
_KV_RE = re.compile(
    r'(?P<lead>["\']?\b(?:' + "|".join(_SENSITIVE_KEYS) + r')\b["\']?\s*[:=]\s*)'
    r'(?P<quote>["\']?)(?P<value>[^"\',\s}]+)(?P=quote)',
    re.IGNORECASE,
)

# "Bearer <token>" can show up without an explicit "authorization" key
# (e.g. a raw header value logged on its own).
_BEARER_RE = re.compile(r'\bBearer\s+\S+', re.IGNORECASE)


def _redact_text(text: str) -> str:
    # Runs before _KV_RE: otherwise "authorization: Bearer <token>" is
    # matched by _KV_RE first (key="authorization"), whose value pattern
    # stops at the first whitespace -- redacting just the word "Bearer"
    # and leaving the actual token right after it untouched.
    text = _BEARER_RE.sub(f"Bearer {REDACTED}", text)
    text = _KV_RE.sub(lambda m: f"{m.group('lead')}{m.group('quote')}{REDACTED}{m.group('quote')}", text)
    return text


class SensitiveDataFilter(logging.Filter):
    """Rewrites record.msg (after %-args are merged in) so every handler
    downstream -- present or future -- only ever sees the redacted text."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = _redact_text(record.getMessage())
            record.args = ()
        except Exception:
            # A record whose args don't merge cleanly (e.g. a %-style
            # message with mismatched args) must still be emitted --
            # redaction is best-effort, never a reason to drop a log line.
            pass
        return True


def install() -> SensitiveDataFilter:
    """Idempotent: safe to call more than once (e.g. once from app/main.py
    at startup, and once more if a later production handler is added --
    see this module's docstring). Returns the filter instance so a new
    handler can be given `handler.addFilter(install())` directly."""
    root = logging.getLogger()
    existing = next((f for f in root.filters if isinstance(f, SensitiveDataFilter)), None)
    sensitive_filter = existing or SensitiveDataFilter()

    if existing is None:
        root.addFilter(sensitive_filter)
    for handler in root.handlers:
        if not any(isinstance(f, SensitiveDataFilter) for f in handler.filters):
            handler.addFilter(sensitive_filter)
    if not any(isinstance(f, SensitiveDataFilter) for f in logging.lastResort.filters):
        logging.lastResort.addFilter(sensitive_filter)

    return sensitive_filter
