"""Sentry error reporting, entirely opt-in via SENTRY_DSN.

`sentry-sdk` is NOT in requirements.txt (adding a new dependency was out
of scope for this change) -- init_sentry() only tries to import it when
SENTRY_DSN is actually set, and logs a clear one-line warning instead of
crashing the app if the package isn't installed. With SENTRY_DSN unset
(the default), this module does nothing at all: no import is even
attempted.

To actually get Sentry reporting in an environment that sets SENTRY_DSN,
`pip install sentry-sdk` there too.
"""
import logging
import os

logger = logging.getLogger("Sentry")

_enabled = False


def capture_exception(exc: BaseException) -> None:
    """No-op unless init_sentry() actually enabled reporting. Never raises
    -- a broken error reporter must never take down the error handler that
    called it (see app/main.py's global_exception_handler)."""
    if not _enabled:
        return
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except Exception:
        logger.exception("Failed to report an exception to Sentry")


def init_sentry() -> bool:
    """Returns True if Sentry was actually initialized. Safe to call at
    import time -- never raises."""
    global _enabled
    dsn = (os.getenv("SENTRY_DSN") or "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logger.warning(
            "SENTRY_DSN is set but the `sentry-sdk` package is not installed "
            "(it is optional, not in requirements.txt) -- Sentry reporting "
            "is disabled. Run: pip install sentry-sdk"
        )
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENV", "development"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
        )
        _enabled = True
        logger.info("Sentry error reporting enabled")
        return True
    except Exception:
        logger.exception("Sentry initialization failed; continuing without it")
        return False
