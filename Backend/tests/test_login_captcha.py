"""CAPTCHA (Cloudflare Turnstile) on starting a Google/GitHub sign-in -- and
nowhere else. Login and sign-up share that start, so both get it (owner
decision 2026-09-30). Cloudflare is faked at its one HTTP call
(app.services.captcha._siteverify); see app/routers/auth/oauth/shared.py."""
import logging
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

import app.routers.auth.oauth.github as github_mod
import app.routers.auth.oauth.google as google_mod
from app.config.urls import FRONTEND_URL
from app.core.secrets_check import check_secrets
from app.routers.auth.oauth.state import oauth_state_cookie_name
from conftest import TEST_PASSWORD
from llm_fakes import fake_llm  # noqa: F401  (fixture)

PROVIDERS = {"google": "accounts.google.com", "github": "github.com"}
# Cloudflare's published always-pass test secret; the fake never sends it anywhere.
TEST_SECRET = "1x0000000000000000000000000000000AA"


class FakeCloudflare:
    def __init__(self):
        self.calls = []
        self.answer = {"success": True, "hostname": "vatsaai.com"}
        self.error = None

    async def __call__(self, payload):
        self.calls.append(payload)
        if self.error:
            raise self.error
        return self.answer


@pytest.fixture()
def providers(monkeypatch):
    for mod, prefix in ((google_mod, "GOOGLE"), (github_mod, "GITHUB")):
        monkeypatch.setattr(mod, f"{prefix}_CLIENT_ID", "test-client-id")
        monkeypatch.setattr(mod, f"{prefix}_CLIENT_SECRET", "test-client-secret")
        monkeypatch.setattr(mod, f"{prefix}_REDIRECT_URI", "https://api.example.com/callback")


@pytest.fixture()
def cloudflare(monkeypatch):
    fake = FakeCloudflare()
    monkeypatch.setattr("app.services.captcha._siteverify", fake)
    return fake


@pytest.fixture()
def captcha_on(monkeypatch, cloudflare):
    monkeypatch.setenv("TURNSTILE_ENABLED", "true")
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", TEST_SECRET)
    return cloudflare


def start(client, provider, token=None, method="POST"):
    url = f"/api/auth/{provider}/login"
    if method == "GET":
        return client.get(url, follow_redirects=False)
    return client.post(url, data={} if token is None else {"cf-turnstile-response": token}, follow_redirects=False)


def went_to_provider(res, provider):
    return urlparse(res.headers["location"]).netloc == PROVIDERS[provider]


def error_of(res):
    loc = urlparse(res.headers["location"])
    assert f"{loc.scheme}://{loc.netloc}" == FRONTEND_URL and loc.path == "/auth/callback"
    return parse_qs(loc.query)["error"][0]


@pytest.mark.parametrize("provider", PROVIDERS)
def test_a_valid_token_starts_the_sign_in(client, providers, captcha_on, provider):
    res = start(client, provider, "tok-valid")
    # 303, so the browser follows with a GET (a 307 would re-POST to Google/GitHub).
    assert res.status_code == 303 and went_to_provider(res, provider)
    assert oauth_state_cookie_name(provider) in res.headers.get("set-cookie", "")
    assert len(captcha_on.calls) == 1
    call = captcha_on.calls[0]
    assert (call["secret"], call["response"], call["remoteip"]) == (TEST_SECRET, "tok-valid", "testclient")


@pytest.mark.parametrize("provider", PROVIDERS)
def test_a_rejected_token_does_not_start_it(client, providers, captcha_on, provider):
    captcha_on.answer = {"success": False, "error-codes": ["invalid-input-response"]}
    res = start(client, provider, "tok-forged")
    assert res.status_code == 303 and error_of(res) == "captcha_failed"
    assert oauth_state_cookie_name(provider) not in res.headers.get("set-cookie", "")


@pytest.mark.parametrize("provider", PROVIDERS)
def test_no_token_is_refused_without_asking_cloudflare(client, providers, captcha_on, provider):
    assert error_of(start(client, provider)) == "captcha_required"
    # The old GET link (and /signup, which uses the same start) can't skip it.
    res = start(client, provider, method="GET")
    assert res.status_code == 307 and error_of(res) == "captcha_required"
    assert captcha_on.calls == []


@pytest.mark.parametrize("provider", PROVIDERS)
def test_with_the_captcha_off_no_token_is_needed(client, providers, cloudflare, monkeypatch, provider):
    monkeypatch.setenv("TURNSTILE_ENABLED", "false")
    get = start(client, provider, method="GET")
    assert get.status_code == 307 and went_to_provider(get, provider)
    post = start(client, provider, "ignored-token")
    assert post.status_code == 303 and went_to_provider(post, provider)
    assert cloudflare.calls == []


@pytest.mark.parametrize("outage", [httpx.ConnectTimeout("timed out"), httpx.ConnectError("dns")])
def test_cloudflare_unreachable_lets_the_sign_in_go_ahead(client, providers, captcha_on, outage, caplog):
    captcha_on.error = outage
    with caplog.at_level(logging.WARNING, logger="Captcha"):
        res = start(client, "google", "tok-while-down")
    assert went_to_provider(res, "google")
    assert "captcha unavailable" in caplog.text


def test_cloudflare_internal_error_lets_the_sign_in_go_ahead(client, providers, captcha_on):
    captcha_on.answer = {"success": False, "error-codes": ["internal-error"]}
    assert went_to_provider(start(client, "github", "tok"), "github")


def test_the_token_is_never_logged(client, providers, captcha_on, caplog):
    secret_token = f"tok-{uuid.uuid4().hex}"
    with caplog.at_level(logging.INFO, logger="Captcha"):
        start(client, "google", secret_token)                     # passed
        captcha_on.answer = {"success": False, "error-codes": ["timeout-or-duplicate"]}
        start(client, "google", secret_token)                     # failed
        captcha_on.error = httpx.ReadTimeout("slow")
        start(client, "google", secret_token)                     # unavailable
    assert secret_token not in caplog.text
    assert "captcha passed" in caplog.text and "captcha failed timeout-or-duplicate" in caplog.text
    assert "ip=testclient" in caplog.text


def test_cloudflare_is_asked_at_most_10_times_a_minute_per_ip(client, providers, captcha_on):
    results = [start(client, "google", f"tok-{i}") for i in range(11)]
    assert all(went_to_provider(r, "google") for r in results[:10])
    assert error_of(results[10]) == "too_many_attempts"
    assert len(captcha_on.calls) == 10


def test_nothing_else_asks_for_a_captcha(client, make_user, captcha_on, fake_llm, monkeypatch):
    """With the CAPTCHA on: password login, reset code, 2FA, the retired
    sign-up, reviews, feedback, chat and /me all work as before and never
    reach Cloudflare."""
    monkeypatch.setattr("app.routers.auth.otp.send_otp_email", lambda to, code, purpose="reset": True)
    monkeypatch.setenv("EMAIL_USERNAME", "noreply@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "unit-test-only")
    user, headers = make_user()  # signs in with a password: already no CAPTCHA
    marker = uuid.uuid4().hex[:8].translate(str.maketrans("0123456789", "ghijklmnop"))
    review = {"rating": 5, "title": "Great assistant", "body": f"Clear and quick answers every day. Ref {marker}.",
              "pros": ["Fast"], "cons": [], "tags": []}
    expected = {
        "password login": (client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD}), 200),
        "reset code": (client.post("/auth/otp/send", json={"email": user.email, "purpose": "reset"}), 200),
        "2fa verify": (client.post("/auth/2fa/verify-login", json={"pending_token": "not-a-token", "code": "000000"}), 401),
        "retired sign-up": (client.post("/auth/register", json={"email": "new@example.com", "password": "x" * 12}), 410),
        "review": (client.post("/api/reviews", json=review, headers=headers), 201),
        "feedback": (client.post("/api/feedback", json={"type": "bug", "message": "The send button does nothing.", "rating": 3}, headers=headers), 201),
        "chat": (client.post("/api/chat", json={"message": "hello"}, headers=headers), 200),
        "me": (client.get("/auth/me", headers=headers), 200),
    }
    for name, (res, status) in expected.items():
        assert res.status_code == status, f"{name}: {res.status_code} {res.text[:200]}"
        assert "captcha" not in res.text.lower(), name
    assert captcha_on.calls == []


def test_startup_refuses_the_captcha_on_without_a_key():
    def problems(env):
        return [p for p in check_secrets(env, leaked={}) if "TURNSTILE" in p]

    assert problems({"TURNSTILE_ENABLED": "true"})
    assert problems({"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": TEST_SECRET}) == []
    assert problems({"TURNSTILE_ENABLED": "false"}) == []
    assert problems({}) == []
