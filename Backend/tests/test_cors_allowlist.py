"""CORS must be an explicit allowlist -- a disallowed Origin gets no
Access-Control-Allow-Origin header back, and the wildcard is never used
(see app/config/urls.py:allowed_origins() and app/main.py's
CORSMiddleware setup)."""
from app.config.urls import allowed_origins


def test_allowed_origins_is_never_a_wildcard():
    origins = allowed_origins()
    assert "*" not in origins
    assert len(origins) > 0


def test_disallowed_origin_gets_no_cors_header(client):
    disallowed = "https://evil-attacker.example.net"
    assert disallowed not in allowed_origins()

    res = client.get("/health", headers={"Origin": disallowed})
    assert res.status_code == 200  # the request itself still succeeds
    assert "access-control-allow-origin" not in {h.lower() for h in res.headers}


def test_allowed_origin_gets_its_own_origin_echoed_back(client):
    allowed = allowed_origins()[0]
    res = client.get("/health", headers={"Origin": allowed})
    assert res.headers.get("access-control-allow-origin") == allowed
