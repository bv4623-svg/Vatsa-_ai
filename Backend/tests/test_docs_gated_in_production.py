"""ENV=production must disable /docs, /redoc and /openapi.json -- the route
surface should never be publicly browsable outside dev/staging. The shared
test-session `app` (imported once by conftest.py with ENV unset) exercises
the non-production branch; the production branch is checked in a fresh
subprocess since docs_url is decided once at FastAPI() construction time,
at import time, and can't be toggled by re-importing an already-imported
module."""
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent

PROBE = (
    "from fastapi.testclient import TestClient; from app.main import app;"
    "c = TestClient(app);"
    "print(app.docs_url); print(app.redoc_url); print(app.openapi_url);"
    "print(c.get('/docs').status_code); print(c.get('/openapi.json').status_code)"
)


def _probe(env_value):
    env = {**os.environ, "JWT_SECRET_KEY": "x" * 40, "REDIS_URL": ""}
    env.pop("DATABASE_URL", None)
    if env_value is not None:
        env["ENV"] = env_value
    else:
        env.pop("ENV", None)
    res = subprocess.run([sys.executable, "-c", PROBE], cwd=BACKEND, env=env,
                          capture_output=True, text=True, timeout=60)
    assert res.returncode == 0, res.stderr[-2000:]
    return res.stdout.strip().splitlines()


def test_docs_disabled_when_env_is_production():
    docs_url, redoc_url, openapi_url, docs_status, openapi_status = _probe("production")
    assert docs_url == "None"
    assert redoc_url == "None"
    assert openapi_url == "None"
    assert docs_status == "404"
    assert openapi_status == "404"


def test_docs_enabled_when_env_is_unset():
    docs_url, redoc_url, openapi_url, docs_status, openapi_status = _probe(None)
    assert docs_url == "/docs"
    assert redoc_url == "/redoc"
    assert openapi_url == "/openapi.json"
    assert docs_status == "200"
    assert openapi_status == "200"


def test_docs_enabled_in_the_shared_test_session(client):
    """The main suite's `app` is imported with ENV unset -- confirms the
    dev-mode path this same process already exercises, not just the probe."""
    from app.main import app as shared_app
    assert shared_app.docs_url == "/docs"
    assert client.get("/openapi.json").status_code == 200
