"""B13: RequestLoggingMiddleware emits one structured log line per request
with request_id/user_id/method/path/status/latency_ms/db_query_count/
cache_hit, and feeds app.observability.route_status_counters. See
app/middleware/request_logging.py."""
import logging

from app.observability import route_status_counters


def test_request_gets_an_x_request_id_response_header(client):
    res = client.get("/health")
    assert "X-Request-ID" in res.headers


def test_a_client_supplied_request_id_is_echoed_back(client):
    res = client.get("/health", headers={"X-Request-ID": "my-custom-id"})
    assert res.headers["X-Request-ID"] == "my-custom-id"


def test_request_log_line_has_the_expected_structured_fields(client, caplog):
    with caplog.at_level(logging.INFO, logger="RequestLog"):
        client.get("/health")

    records = [r for r in caplog.records if r.name == "RequestLog"]
    assert records, "expected at least one RequestLog record"
    record = records[-1]
    for field in ("request_id", "user_id", "method", "path", "status", "latency_ms", "db_query_count", "cache_hit"):
        assert hasattr(record, field), f"missing field: {field}"
    assert record.method == "GET"
    assert record.path == "/health"
    assert record.status == 200


def test_authenticated_request_logs_the_real_user_id(client, make_user, caplog):
    user, headers = make_user()
    with caplog.at_level(logging.INFO, logger="RequestLog"):
        client.get("/auth/me", headers=headers)

    records = [r for r in caplog.records if r.name == "RequestLog" and r.path == "/auth/me"]
    assert records
    assert records[-1].user_id == str(user.id)


def test_a_request_that_queries_the_db_has_a_nonzero_query_count(client, make_user, caplog):
    _, headers = make_user()
    with caplog.at_level(logging.INFO, logger="RequestLog"):
        client.get("/auth/me", headers=headers)

    records = [r for r in caplog.records if r.name == "RequestLog" and r.path == "/auth/me"]
    assert records
    assert records[-1].db_query_count > 0


def test_route_status_counters_are_recorded_by_pattern_not_raw_path(client):
    client.get("/health")
    body = route_status_counters.prometheus()
    assert 'route="/health"' in body
    assert 'status="200"' in body
    assert 'method="GET"' in body
