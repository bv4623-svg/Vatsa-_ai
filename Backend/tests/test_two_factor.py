"""Two-factor authentication: setup, enable, login with TOTP and backup
codes, disable, and storage at rest. A leaked database (BUG-001 shipped
one in git history) must not be enough to pass 2FA."""
import hashlib

import pyotp
import pytest

from conftest import TEST_PASSWORD
from app.models.user import User


def _enable(client, headers):
    setup = client.post("/api/account/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    enabled = client.post("/api/account/2fa/enable", json={"code": pyotp.TOTP(secret).now()}, headers=headers)
    assert enabled.status_code == 200, enabled.text
    return secret, enabled.json()["backupCodes"]


def _login(client, email):
    res = client.post("/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()


def _fresh(db, user_id):
    db.expire_all()
    return db.query(User).filter_by(id=user_id).first()


def test_full_flow_totp_and_single_use_backup_codes(client, make_user):
    user, headers = make_user()
    secret, backup_codes = _enable(client, headers)
    assert len(backup_codes) == 8

    first = _login(client, user.email)
    assert first == {"requires_2fa": True, "pending_token": first["pending_token"]}
    # The pending token is not a session.
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {first['pending_token']}"}).status_code == 401

    ok = client.post("/auth/2fa/verify-login", json={"pending_token": first["pending_token"], "code": pyotp.TOTP(secret).now()})
    assert ok.status_code == 200 and ok.json()["access_token"]

    second = _login(client, user.email)
    code = backup_codes[0]
    assert client.post("/auth/2fa/verify-login", json={"pending_token": second["pending_token"], "code": code}).status_code == 200
    third = _login(client, user.email)
    replay = client.post("/auth/2fa/verify-login", json={"pending_token": third["pending_token"], "code": code})
    assert replay.status_code == 400, "a backup code must work only once"


def test_wrong_code_rejected(client, make_user):
    user, headers = make_user()
    _enable(client, headers)
    pending = _login(client, user.email)["pending_token"]
    assert client.post("/auth/2fa/verify-login", json={"pending_token": pending, "code": "000000"}).status_code == 400


def test_enable_requires_setup_and_valid_code(client, make_user):
    _, headers = make_user()
    assert client.post("/api/account/2fa/enable", json={"code": "123456"}, headers=headers).status_code == 400
    client.post("/api/account/2fa/setup", headers=headers)
    assert client.post("/api/account/2fa/enable", json={"code": "123456"}, headers=headers).status_code == 400


def test_totp_secret_is_encrypted_at_rest(client, make_user, db):
    user, headers = make_user()
    secret, _ = _enable(client, headers)
    stored = _fresh(db, user.id).totp_secret
    assert stored != secret
    assert secret not in stored
    assert stored.startswith("enc:v1:")


def test_backup_codes_are_not_plain_sha256_at_rest(client, make_user, db):
    """Plain SHA-256 of an 8-hex-char code is brute-forced from a DB dump in
    seconds (2^32 guesses). Stored hashes must need the server's key."""
    user, headers = make_user()
    _, codes = _enable(client, headers)
    stored = _fresh(db, user.id).backup_codes
    assert len(stored) == 8
    for code in codes:
        assert hashlib.sha256(code.encode()).hexdigest() not in stored


def test_legacy_plaintext_secret_and_hashes_still_work_and_get_upgraded(client, make_user, db):
    """Rows written before encryption existed keep working, and are
    re-encrypted on the next successful verification."""
    user, _ = make_user()
    secret = pyotp.random_base32()
    legacy_code = "abcd1234"
    row = _fresh(db, user.id)
    row.totp_secret = secret
    row.backup_codes = [hashlib.sha256(legacy_code.encode()).hexdigest()]
    row.two_factor_enabled = True
    db.commit()

    pending = _login(client, user.email)["pending_token"]
    assert client.post("/auth/2fa/verify-login", json={"pending_token": pending, "code": pyotp.TOTP(secret).now()}).status_code == 200
    assert _fresh(db, user.id).totp_secret.startswith("enc:v1:")

    pending = _login(client, user.email)["pending_token"]
    assert client.post("/auth/2fa/verify-login", json={"pending_token": pending, "code": legacy_code}).status_code == 200
    assert _fresh(db, user.id).backup_codes == []


def test_undecryptable_secret_fails_closed(client, make_user, db):
    user, _ = make_user()
    row = _fresh(db, user.id)
    row.totp_secret = "enc:v1:not-a-valid-token"
    row.two_factor_enabled = True
    db.commit()
    pending = _login(client, user.email)["pending_token"]
    res = client.post("/auth/2fa/verify-login", json={"pending_token": pending, "code": "123456"})
    assert res.status_code == 400


def test_disable_requires_password_and_clears_secrets(client, make_user, db):
    user, headers = make_user()
    _enable(client, headers)
    assert client.post("/api/account/2fa/disable", json={"password": "nope"}, headers=headers).status_code == 400
    assert client.post("/api/account/2fa/disable", json={"password": TEST_PASSWORD}, headers=headers).status_code == 200
    row = _fresh(db, user.id)
    assert row.totp_secret is None and row.backup_codes == [] and not row.two_factor_enabled


@pytest.mark.parametrize("value", ["", None])
def test_crypto_helpers_handle_empty(value):
    from app.services.crypto import decrypt_str, encrypt_str
    assert encrypt_str(value) == value
    assert decrypt_str(value) == value


def test_backup_code_cannot_be_used_twice_concurrently(client, make_user, db):
    """Two logins racing with the same backup code: both load the user
    before either commits. Exactly one may succeed."""
    from app.database import SessionLocal
    from app.services.account import consume_backup_code, hash_backup_codes

    user, _ = make_user()
    row = _fresh(db, user.id)
    row.backup_codes = hash_backup_codes(["race0001", "other002"])
    row.two_factor_enabled = True
    db.commit()

    s1, s2 = SessionLocal(), SessionLocal()
    try:
        u1 = s1.query(User).filter_by(id=user.id).first()
        u2 = s2.query(User).filter_by(id=user.id).first()
        _ = (list(u1.backup_codes), list(u2.backup_codes))  # both read before either writes
        results = []
        for session, u in ((s1, u1), (s2, u2)):
            results.append(consume_backup_code(u, "race0001", session))
            session.commit()
    finally:
        s1.close()
        s2.close()
    assert sorted(results) == [False, True], results
    remaining = _fresh(db, user.id).backup_codes
    assert len(remaining) == 1, "only the used code is removed; the other survives"


# ── Google/GitHub sign-in ────────────────────────────────────────────

def _oauth_callback(user):
    """Where the Google/GitHub callback sends the browser, as query params."""
    from urllib.parse import parse_qs, urlparse
    from app.routers.auth.oauth.shared import redirect_with_token
    location = redirect_with_token(user).headers["location"]
    return {k: v[0] for k, v in parse_qs(urlparse(location).query).items()}


def test_google_or_github_signin_still_asks_for_the_2fa_code(client, make_user, db, monkeypatch):
    """The provider proves the email, not the second factor: an account with
    2FA on (an admin here) gets no session until the code is entered."""
    user, headers = make_user()
    secret, _ = _enable(client, headers)
    monkeypatch.setenv("ADMIN_EMAILS", user.email)

    params = _oauth_callback(_fresh(db, user.id))
    assert params.get("requires_2fa") == "true"
    assert "access_token" not in params
    pending = {"Authorization": f"Bearer {params['pending_token']}"}
    assert client.get("/auth/me", headers=pending).status_code == 401
    assert client.get("/api/feedback", headers=pending).status_code == 401

    bad = client.post("/auth/2fa/verify-login", json={"pending_token": params["pending_token"], "code": "000000"})
    assert bad.status_code == 400
    ok = client.post("/auth/2fa/verify-login", json={"pending_token": params["pending_token"], "code": pyotp.TOTP(secret).now()})
    assert ok.status_code == 200, ok.text
    session = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert client.get("/api/feedback", headers=session).status_code == 200


def test_google_or_github_signin_without_2fa_is_a_session_straight_away(client, make_user, db):
    user, _ = make_user()
    params = _oauth_callback(_fresh(db, user.id))
    assert "requires_2fa" not in params and "pending_token" not in params
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {params['access_token']}"}).status_code == 200
