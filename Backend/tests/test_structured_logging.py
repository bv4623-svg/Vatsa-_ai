"""B13: JSON logs in production, human-readable in dev. See
app/utils/structured_logging.py."""
import io
import json
import logging

from app.utils.structured_logging import JsonFormatter, HumanFormatter, install


def _format_with(formatter, **extra):
    logger = logging.getLogger("test_structured_logging_probe")
    record = logger.makeRecord(
        logger.name, logging.INFO, __file__, 1, "something happened", (), None, extra=extra,
    )
    return formatter.format(record)


def test_json_formatter_produces_valid_json_with_expected_fields():
    line = _format_with(JsonFormatter(), request_id="abc-123", status=200, latency_ms=12.5)
    data = json.loads(line)
    assert data["message"] == "something happened"
    assert data["level"] == "INFO"
    assert data["request_id"] == "abc-123"
    assert data["status"] == 200
    assert data["latency_ms"] == 12.5


def test_json_formatter_includes_exception_traceback():
    logger = logging.getLogger("test_structured_logging_probe")
    try:
        raise ValueError("boom")
    except ValueError:
        record = logger.makeRecord(
            logger.name, logging.ERROR, __file__, 1, "failed", (), __import__("sys").exc_info(),
        )
    data = json.loads(JsonFormatter().format(record))
    assert "ValueError" in data["exception"]
    assert "boom" in data["exception"]


def test_human_formatter_is_readable_text_not_json():
    line = _format_with(HumanFormatter(), request_id="abc-123")
    assert "abc-123" in line
    assert "something happened" in line
    try:
        json.loads(line)
        assert False, "human formatter output should not itself be valid JSON"
    except json.JSONDecodeError:
        pass


def test_install_is_idempotent_and_attaches_one_handler():
    before = len([h for h in logging.getLogger().handlers if getattr(h, "_vatsa_structured", False)])
    install()
    install()
    after = len([h for h in logging.getLogger().handlers if getattr(h, "_vatsa_structured", False)])
    assert after == before + (0 if before else 1)
    assert after == 1
