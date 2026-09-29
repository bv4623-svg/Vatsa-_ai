"""An exception nobody caught must still never hand the client a secret,
a stack trace, or any other internal detail -- see the
`@app.exception_handler(Exception)` in app/main.py."""
from fastapi.testclient import TestClient

from app.main import app
from app.auth.dependencies import get_current_user

FAKE_SECRET = "sk-live-FAKESECRET1234567890"


def _boom():
    raise RuntimeError(f"upstream call failed: api_key={FAKE_SECRET}")


def test_unhandled_exception_never_leaks_its_message_to_the_client():
    # Overrides a dependency (FastAPI's own supported test mechanism) rather
    # than adding a route or touching business logic, so any route that
    # depends on get_current_user will raise before it does anything else.
    app.dependency_overrides[get_current_user] = _boom
    try:
        # raise_server_exceptions=False lets the exception flow through the
        # real ASGI middleware stack (so the real handler runs), instead of
        # re-raising it into the test process the way TestClient does by
        # default. No `with` block: that would also re-run this app's
        # lifespan (scheduler startup/shutdown), which the rest of the test
        # session's shared client still needs alive.
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/auth/me")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert res.status_code == 500
    assert FAKE_SECRET not in res.text
    assert "api_key" not in res.text
    assert "RuntimeError" not in res.text
    assert "Traceback" not in res.text
    assert res.json() == {"error": {"code": "internal_error", "message": "Something went wrong"}}
