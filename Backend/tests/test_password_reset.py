"""Password reset, end to end through the real routes. Email delivery is
faked (it's the only external call); everything else (OTP storage, reset
token, bcrypt, token_version revocation) is real."""
import pyotp
import pytest

from conftest import TEST_PASSWORD

NEW_PASSWORD = "a-brand-new-password-2"


@pytest.fixture()
def outbox(monkeypatch):
    """Captures OTP emails instead of sending them."""
    sent = []
    monkeypatch.setenv("EMAIL_USERNAME", "mailer@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "fake-smtp-password")
    monkeypatch.setattr("app.routers.auth.otp.send_otp_email", lambda to, code, purpose="signup": sent.append((to, code, purpose)) or True)
    return sent


def _otp(client, outbox, email, purpose):
    res = client.post("/auth/otp/send", json={"email": email, "purpose": purpose})
    assert res.status_code == 200, res.text
    to, code, sent_purpose = outbox[-1]
    assert (to, sent_purpose) == (email, purpose)
    return code


def test_reset_flow_changes_password_and_ends_existing_sessions(client, make_user, outbox):
    user, old_session = make_user()
    assert client.get("/auth/me", headers=old_session).status_code == 200

    code = _otp(client, outbox, user.email, "reset")
    verified = client.post("/auth/otp/verify", json={"email": user.email, "otp": code})
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert "access_token" not in body, "a reset OTP must not log the user in"
    reset = client.post("/auth/reset-password", json={"email": user.email, "reset_token": body["reset_token"], "password": NEW_PASSWORD})
    assert reset.status_code == 200, reset.text

    assert client.get("/auth/me", headers=old_session).status_code == 401, "sessions from before the reset must end"
    assert client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD}).status_code == 400
    assert client.post("/auth/login", json={"email": user.email, "password": NEW_PASSWORD}).status_code == 200


def test_reset_token_cannot_be_used_as_a_session_or_for_another_email(client, make_user, outbox):
    user, _ = make_user()
    other, _ = make_user()
    code = _otp(client, outbox, user.email, "reset")
    reset_token = client.post("/auth/otp/verify", json={"email": user.email, "otp": code}).json()["reset_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {reset_token}"}).status_code == 401
    res = client.post("/auth/reset-password", json={"email": other.email, "reset_token": reset_token, "password": NEW_PASSWORD})
    assert res.status_code == 400


def test_otp_code_is_never_written_to_the_log(client, make_user, outbox, capsys):
    """Anyone who can read the server log could otherwise reset any account."""
    user, _ = make_user()
    code = _otp(client, outbox, user.email, "reset")
    captured = capsys.readouterr()
    assert code not in captured.out + captured.err


def test_an_emailed_code_never_logs_anyone_in(client, make_user, outbox):
    """Codes are for password reset only: even for a 2FA account, verifying
    one yields a reset token, never a session or a 2FA-pending login."""
    user, headers = make_user()
    secret = client.post("/api/account/2fa/setup", headers=headers).json()["secret"]
    assert client.post("/api/account/2fa/enable", json={"code": pyotp.TOTP(secret).now()}, headers=headers).status_code == 200

    code = _otp(client, outbox, user.email, "reset")
    body = client.post("/auth/otp/verify", json={"email": user.email, "otp": code}).json()
    assert set(body) == {"verified", "reset_token"}
    assert client.post("/auth/otp/send", json={"email": user.email, "purpose": "login"}).status_code == 410
