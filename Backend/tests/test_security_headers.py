"""Confirms SecurityHeadersMiddleware (app/middleware/security_headers.py)
is actually wired into the app and sets every header Step 3 item 6 asks
for. No code change was needed here -- this just makes that fact checkable
instead of asserted from reading the source."""


def test_security_headers_present_on_every_response(client):
    res = client.get("/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert res.headers["Content-Security-Policy"]  # present (locked-down API policy)
    # HSTS is deliberately scheme-gated (see the middleware's own comment):
    # a plain-http test client request must not carry it.
    assert "Strict-Transport-Security" not in res.headers
