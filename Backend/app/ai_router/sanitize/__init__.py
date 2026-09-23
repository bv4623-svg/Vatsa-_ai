"""Keeps provider and model identity out of anything a user can see.

This is a safety net behind the real defence, which is that the router only
ever raises errors with fixed public messages. It exists for strings that come
from somewhere else and might still carry an upstream name.

Split into patterns.py/redact.py/streaming.py; every public name is
re-exported here so `from app.ai_router.sanitize import X` keeps working
exactly as it did when this was one file.
"""
from app.ai_router.sanitize.patterns import REDACTED
from app.ai_router.sanitize.redact import contains_identity, redact_identity
from app.ai_router.sanitize.streaming import StreamingRedactor

__all__ = ["REDACTED", "contains_identity", "redact_identity", "StreamingRedactor"]
