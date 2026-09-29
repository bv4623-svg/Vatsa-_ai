"""Emailed codes are for password reset only, and an account whose email was
never proven (a legacy password account with is_verified=False) can't reach
admin access and is taken over by a Google/GitHub sign-in for its address.

New email/password sign-up itself is retired (410, Google/GitHub only):
see test_auth_cleanup.py."""
import pytest

from app.models.user import User
from app.routers.auth.oauth.shared import get_or_create_oauth_user
from conftest import TEST_PASSWORD, TEST_PASSWORD_HASH


@pytest.fixture()
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr("app.routers.auth.otp.send_otp_email", lambda to, code, purpose="reset": sent.append((to, purpose)) or True)
    monkeypatch.setenv("EMAIL_USERNAME", "noreply@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "unit-test-only")
    return sent


@pytest.fixture()
def unverified_account(client, db):
    """A legacy password account whose email was never proven."""
    def _make(email):
        user = User(email=email, username=email.split("@")[0], full_name="Unproven", hashed_password=TEST_PASSWORD_HASH,
                    is_active=True, is_verified=False, tier="free")
        db.add(user)
        db.commit()
        db.refresh(user)
        res = client.post("/auth/login", json={"email": email, "password": TEST_PASSWORD})
        assert res.status_code == 200, res.text
        return user, {"Authorization": f"Bearer {res.json()['access_token']}"}
    return _make


def test_signup_and_login_codes_are_gone(client, outbox):
    for purpose in ("signup", "login", ""):
        res = client.post("/auth/otp/send", json={"email": "anyone@example.com", "purpose": purpose})
        assert res.status_code == 410, res.text
    assert outbox == []


def test_password_reset_still_uses_an_emailed_code(client, make_user, outbox):
    user, _ = make_user()
    res = client.post("/auth/otp/send", json={"email": user.email, "purpose": "reset"})
    assert res.status_code == 200, res.text
    assert outbox == [(user.email, "reset")]


def test_an_unverified_account_is_never_an_admin(client, db, monkeypatch, unverified_account):
    user, headers = unverified_account("boss-unproven@example.com")
    monkeypatch.setenv("ADMIN_EMAILS", user.email)
    db.expire_all()
    db.get(User, user.id).two_factor_enabled = True
    db.commit()
    assert client.get("/api/admin/payments?email=a@example.com", headers=headers).status_code == 403


def test_google_signin_takes_over_an_unverified_account(client, db, unverified_account):
    user, squatter = unverified_account("squatted@example.com")

    owner = get_or_create_oauth_user(db, "squatted@example.com", "Real Owner", "google")

    assert owner.id == user.id and owner.is_verified is True and owner.oauth_linked is True
    assert client.get("/auth/me", headers=squatter).status_code == 401  # old sessions revoked
    res = client.post("/auth/login", json={"email": "squatted@example.com", "password": TEST_PASSWORD})
    assert res.status_code == 400  # the unproven password no longer works


def test_google_signin_leaves_a_verified_account_alone(client, db, make_user):
    user, headers = make_user()
    same = get_or_create_oauth_user(db, user.email, "Same Person", "google")

    assert same.id == user.id
    assert client.get("/auth/me", headers=headers).status_code == 200
    assert client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD}).status_code == 200
