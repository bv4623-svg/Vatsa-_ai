"""Log formatting for B13: one JSON object per line when ENV=production
(what a log aggregator wants), a plain human-readable line everywhere
else. install() wires the chosen formatter onto a handler on the root
logger -- see app/main.py."""
import json
import logging
import os
import sys
import traceback

# Fields already on every LogRecord that would be redundant to repeat
# inside the "extra" blob of a JSON log line.
_STANDARD_RECORD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = "".join(traceback.format_exception(*record.exc_info))
        # Any structured field a caller passed via `logging.info(msg, extra={...})`
        # (request_id, user_id, method, path, status, latency_ms, db_query_count,
        # cache_hit -- see app/middleware/request_logging.py) rides along here.
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_ATTRS and key not in payload:
                payload[key] = value
        return json.dumps(payload, default=str)


class HumanFormatter(logging.Formatter):
    """Same structured fields as JsonFormatter, but formatted for a
    developer reading a terminal rather than a log aggregator."""

    _BASE = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"

    def __init__(self) -> None:
        super().__init__(self._BASE, datefmt="%H:%M:%S")

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = {
            key: value for key, value in record.__dict__.items()
            if key not in _STANDARD_RECORD_ATTRS
        }
        if extras:
            base += " | " + " ".join(f"{k}={v}" for k, v in sorted(extras.items()))
        return base


def install() -> logging.Handler:
    """Idempotent: safe to call more than once. Attaches one StreamHandler
    to the root logger with the environment-appropriate formatter, and
    sets the root logger's level to INFO so those per-request log lines
    (currently only WARNING+ reaches anything, via logging.lastResort --
    see app/utils/log_redaction.py's docstring) actually show up."""
    root = logging.getLogger()
    existing = next((h for h in root.handlers if getattr(h, "_vatsa_structured", False)), None)
    if existing is not None:
        return existing

    # stderr, not stdout: several scripts/tests in this codebase spawn a
    # Python subprocess and parse its stdout as data (see
    # tests/test_data_dir.py, tests/test_docs_gated_in_production.py) --
    # logs must never land in that stream. Docker/most log collectors
    # capture both anyway, so nothing is lost.
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JsonFormatter() if os.getenv("ENV") == "production" else HumanFormatter())
    handler._vatsa_structured = True  # marks this handler for the idempotency check above
    root.addHandler(handler)
    if root.level > logging.INFO or root.level == logging.NOTSET:
        root.setLevel(logging.INFO)

    # The redaction filter (see app/utils/log_redaction.py) must cover this
    # new handler too -- its own install() only reaches handlers that
    # existed on root *before* it ran, which for this handler is not the
    # case if install()s run in the order main.py calls them in.
    from app.utils.log_redaction import install as install_log_redaction
    install_log_redaction()

    return handler
