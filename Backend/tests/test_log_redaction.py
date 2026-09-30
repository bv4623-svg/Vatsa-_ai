"""A logged secret must never reach a handler in cleartext -- see
app/utils/log_redaction.py."""
import io
import logging

from app.utils.log_redaction import SensitiveDataFilter, REDACTED, install


def _log_and_capture(message: str, *args) -> str:
    """Logs `message` through a throwaway named logger (matching how every
    real logger in this codebase is created) with the filter attached
    directly to that logger, and returns exactly what a handler would have
    received."""
    logger = logging.getLogger("test_log_redaction_probe")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.filters.clear()
    logger.handlers.clear()

    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.addFilter(SensitiveDataFilter())

    logger.info(message, *args)
    handler.flush()
    return buffer.getvalue().strip()


def test_password_value_is_redacted():
    out = _log_and_capture("login failed: password=SuperSecret123!")
    assert "SuperSecret123!" not in out
    assert REDACTED in out


def test_json_shaped_secret_is_redacted():
    out = _log_and_capture('payload: {"api_key": "sk-or-abc123def456"}')
    assert "sk-or-abc123def456" not in out
    assert REDACTED in out


def test_bearer_token_is_redacted_even_without_a_key():
    out = _log_and_capture("outgoing request header: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")
    assert "eyJhbGciOiJIUzI1NiJ9" not in out
    assert REDACTED in out


def test_percent_style_args_are_redacted_too():
    out = _log_and_capture("user session token=%s", "abcdef123456")
    assert "abcdef123456" not in out
    assert REDACTED in out


def test_non_sensitive_text_passes_through_unchanged():
    out = _log_and_capture("user 42 logged in from 203.0.113.5")
    assert out == "user 42 logged in from 203.0.113.5"


def test_install_attaches_the_filter_to_the_root_logger():
    install()
    root = logging.getLogger()
    assert any(isinstance(f, SensitiveDataFilter) for f in root.filters)
    assert any(isinstance(f, SensitiveDataFilter) for f in logging.lastResort.filters)
