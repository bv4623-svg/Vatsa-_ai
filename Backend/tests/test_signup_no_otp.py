"""Sign-up is email + password with no emailed code; codes exist only for
password reset. An unproven email can't reach admin access, and a
Google/GitHub sign-in for the same address takes the account over."""
import pytest

from app.models.user import User
from app.routers.auth.oauth.shared import get_or_create_oauth_user

PASSWORD = "Signup-without-code-2026"


@pytest.fixture(autouse=True)
def offline_password_policy(monkeypatch):
    monkeypatch.setattr("app.services.password_policy._check_have_i_been_pwned", lambda password: False)


@pytest.fixture(autouse=True)
def fresh_signup_rate_limit():
    """Every test client shares one IP; start each test with its sign-up quota unused."""
    from app.utils import rate_limit
    for key in [k for k in rate_limit._buckets if k.startswith("register:")]:
        rate_limit.reset_rate_limit(key)


@pytest.fixture()
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr("app.routers.auth.otp.send_otp_email", lambda to, code, purpose="reset": sent.append((to, purpose)) or True)
    monkeypatch.setenv("EMAIL_USERNAME", "noreply@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "unit-test-only")
    return sent


def _signup(client, email, password=PASSWORD, **extra):
    return client.post("/auth/register", json={"email": email, "password": password, **extra})


def test_signup_with_email_and_password_needs_no_code(client, outbox):
    res = _signup(client, "no-code@example.com", full_name="No Code")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"] and body["user"]["email"] == "no-code@example.com"
    assert body["user"]["is_verified"] is False
    assert outbox == []  # no email of any kind was sent

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200


def test_every_signup_alias_works(client):
    for i, path in enumerate(("/auth/register", "/api/auth/register", "/api/auth/signup")):
        res = client.post(path, json={"email": f"alias{i}@example.com", "password": PASSWORD})
        assert res.status_code == 200, (path, res.text)


def test_login_works_immediately_after_signup(client):
    assert _signup(client, "then-login@example.com").status_code == 200
    res = client.post("/auth/login", json={"email": "then-login@example.com", "password": PASSWORD})
    assert res.status_code == 200, res.text
    assert res.json()["access_token"]


def test_duplicate_and_weak_signups_are_rejected(client):
    assert _signup(client, "dupe@example.com").status_code == 200
    assert _signup(client, "Dupe@Example.com").status_code == 400
    assert _signup(client, "weak@example.com", password="aaaaaaaaaaaa").status_code == 400  # no digit
    assert _signup(client, "short@example.com", password="short1").status_code == 422


def test_signups_are_rate_limited_per_ip(client):
    for i in range(5):
        assert _signup(client, f"burst{i}@example.com").status_code == 200
    assert _signup(client, "burst5@example.com").status_code == 429


def test_signup_and_login_codes_are_gone(client, outbox):
    for purpose in ("signup", "login"):
        res = client.post("/auth/otp/send", json={"email": "anyone@example.com", "purpose": purpose})
        assert res.status_code == 410, res.text
    assert outbox == []


def test_password_reset_still_uses_an_emailed_code(client, make_user, outbox):
    user, _ = make_user()
    res = client.post("/auth/otp/send", json={"email": user.email, "purpose": "reset"})
    assert res.status_code == 200, res.text
    assert outbox == [(user.email, "reset")]


def test_unverified_signup_is_never_an_admin(client, db, monkeypatch):
    body = _signup(client, "boss-signup@example.com").json()
    monkeypatch.setenv("ADMIN_EMAILS", "boss-signup@example.com")
    db.get(User, body["user"]["id"]).two_factor_enabled = True
    db.commit()
    res = client.get("/api/admin/payments?email=a@example.com", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert res.status_code == 403


def test_google_signin_takes_over_an_unverified_signup(client, db):
    body = _signup(client, "squatted@example.com").json()
    squatter = {"Authorization": f"Bearer {body['access_token']}"}

    owner = get_or_create_oauth_user(db, "squatted@example.com", "Real Owner", "google")

    assert owner.id == body["user"]["id"] and owner.is_verified is True
    assert client.get("/auth/me", headers=squatter).status_code == 401
    res = client.post("/auth/login", json={"email": "squatted@example.com", "password": PASSWORD})
    assert res.status_code == 400


def test_google_signin_leaves_a_verified_account_alone(client, db, make_user):
    from conftest import TEST_PASSWORD

    user, headers = make_user()
    same = get_or_create_oauth_user(db, user.email, "Same Person", "google")

    assert same.id == user.id
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD}).status_code == 200
