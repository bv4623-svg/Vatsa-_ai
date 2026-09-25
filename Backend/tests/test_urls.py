"""app/config/urls.py: production addresses are the fallback, never a local one,
and an environment value (or an accidentally blank/slash-terminated one) is
handled sanely."""
import importlib

import pytest

from app.config import urls

LIVE_FRONTEND = "https://vatsaai.netlify.app"
LIVE_BACKEND = "https://vatsa-ai.onrender.com"


@pytest.fixture()
def fresh_urls(monkeypatch):
    """Re-imports the module under whatever environment the test sets, then
    puts it back so no other test sees the changed constants."""
    def load():
        return importlib.reload(urls)

    yield load, monkeypatch
    monkeypatch.undo()
    importlib.reload(urls)


def test_unset_variables_fall_back_to_the_live_site_not_a_developer_machine(fresh_urls):
    load, monkeypatch = fresh_urls
    for name in ("FRONTEND_REDIRECT_URL", "BACKEND_PUBLIC_URL", "ALLOWED_ORIGINS"):
        monkeypatch.delenv(name, raising=False)
    module = load()

    assert module.FRONTEND_URL == LIVE_FRONTEND
    assert module.BACKEND_PUBLIC_URL == LIVE_BACKEND
    assert module.allowed_origins() == [LIVE_FRONTEND, LIVE_BACKEND]


def test_blank_variables_count_as_unset(fresh_urls):
    load, monkeypatch = fresh_urls
    monkeypatch.setenv("FRONTEND_REDIRECT_URL", "")
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "   ")
    monkeypatch.setenv("ALLOWED_ORIGINS", "")
    module = load()

    assert module.FRONTEND_URL == LIVE_FRONTEND
    assert module.BACKEND_PUBLIC_URL == LIVE_BACKEND
    assert module.allowed_origins() == [LIVE_FRONTEND, LIVE_BACKEND]


def test_environment_values_win_and_trailing_slashes_are_dropped(fresh_urls):
    load, monkeypatch = fresh_urls
    monkeypatch.setenv("FRONTEND_REDIRECT_URL", "https://staging.example.test/")
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "https://api.staging.example.test//")
    monkeypatch.setenv("ALLOWED_ORIGINS", " https://a.example.test/ ,https://b.example.test,, ")
    module = load()

    assert module.FRONTEND_URL == "https://staging.example.test"
    assert module.BACKEND_PUBLIC_URL == "https://api.staging.example.test"
    assert module.allowed_origins() == ["https://a.example.test", "https://b.example.test"]
    # so an OAuth redirect built from it has exactly one slash before the path
    assert f"{module.FRONTEND_URL}/auth/callback" == "https://staging.example.test/auth/callback"


def test_allowed_origins_is_read_at_call_time(fresh_urls):
    load, monkeypatch = fresh_urls
    module = load()
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://later.example.test")
    assert module.allowed_origins() == ["https://later.example.test"]


def test_oauth_error_redirect_is_built_from_the_central_frontend_url():
    """The helper the Google/GitHub callbacks both use."""
    from app.routers.auth.oauth import shared

    response = shared.redirect_with_error("google_not_configured")
    assert shared.FRONTEND_URL == urls.FRONTEND_URL
    assert response.headers["location"] == f"{urls.FRONTEND_URL}/auth/callback?error=google_not_configured"
