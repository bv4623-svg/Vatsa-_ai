"""Error types.

Two families, kept apart on purpose:

* ProviderError  - what an adapter raises. Carries the provider's own error
  text in `.detail` for server logs. Its str() is generic, so an accidental
  f"{e}" can never leak that text.
* RouterError    - what the router raises to the application. Its str() and
  `.public_message` are safe to show a user.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

PUBLIC_UNAVAILABLE = "AI service is temporarily unavailable. Please try again shortly."
PUBLIC_BUSY = "AI service is busy right now. Please try again in a moment."


class ErrorKind(str, Enum):
    TIMEOUT = "timeout"
    CONNECTION = "connection"
    RATE_LIMITED = "rate_limited"
    SERVER_ERROR = "server_error"
    BAD_REQUEST = "bad_request"
    AUTH = "auth"
    NOT_FOUND = "not_found"
    CONTENT_POLICY = "content_policy"
    EMPTY_RESPONSE = "empty_response"
    UNKNOWN = "unknown"


# Failures that say something about the provider/model's health. A malformed
# request or a content-policy refusal is our input's fault, so it must not
# push a healthy model toward an open circuit.
HEALTH_AFFECTING = frozenset({
    ErrorKind.TIMEOUT,
    ErrorKind.CONNECTION,
    ErrorKind.RATE_LIMITED,
    ErrorKind.SERVER_ERROR,
    ErrorKind.AUTH,
    ErrorKind.NOT_FOUND,
    ErrorKind.EMPTY_RESPONSE,
    ErrorKind.UNKNOWN,
})


class ProviderError(Exception):
    def __init__(
        self,
        kind: ErrorKind,
        *,
        status: Optional[int] = None,
        retry_after: Optional[float] = None,
        detail: str = "",
    ) -> None:
        super().__init__(f"provider error ({kind.value})")
        self.kind = kind
        self.status = status
        self.retry_after = retry_after
        self.detail = detail  # internal only: never put this in a user-facing message


class RouterError(RuntimeError):
    """Raised by the router. Subclasses RuntimeError so existing
    `except Exception` paths keep working, and str(e) is already safe."""

    code = "ai_unavailable"

    def __init__(self, public_message: str = PUBLIC_UNAVAILABLE, *, retry_after: Optional[float] = None) -> None:
        super().__init__(public_message)
        self.public_message = public_message
        self.retry_after = retry_after


class AllProvidersFailed(RouterError):
    code = "ai_unavailable"


class NoEligibleModel(RouterError):
    """No configured model can serve this request (misconfiguration or every
    model disabled/incapable). Reported to the user like any outage."""

    code = "ai_unavailable"


class RouterOverloaded(RouterError):
    """Backpressure: the router refused the request instead of queueing it."""

    code = "ai_busy"

    def __init__(self, retry_after: Optional[float] = 2.0) -> None:
        super().__init__(PUBLIC_BUSY, retry_after=retry_after)
