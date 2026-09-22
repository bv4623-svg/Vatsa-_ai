"""Regression test: the OTP-login branch of POST /auth/otp/verify used to
mint a login token with no "tv" (token_version) claim, unlike every other
login path (password login, OAuth, 2FA). A token missing "tv" is treated as
a pre-token-version legacy session and is never invalidated by a password
reset or a future "sign out other devices" feature -- see
get_current_user() in app/auth/dependencies/core.py. See app/routers/auth/otp.py."""
from datetime import datetime, timedelta

from app.auth.jwt import decode_access_token
from app.models.otp import OTP


def test_otp_login_token_carries_token_version(db, client, make_user):
    user, _ = make_user()

    otp = OTP.create_otp(user.email, "login", "123456", expires_in_minutes=5)
    db.add(otp)
    db.commit()

    res = client.post("/auth/otp/verify", json={"email": user.email, "otp": "123456"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["verified"] is True

    payload = decode_access_token(body["access_token"])
    assert payload is not None
    assert "tv" in payload
    assert payload["tv"] == user.token_version


def test_otp_login_token_is_revoked_by_a_token_version_bump(db, client, make_user):
    user, _ = make_user()

    otp = OTP.create_otp(user.email, "login", "654321", expires_in_minutes=5)
    db.add(otp)
    db.commit()

    res = client.post("/auth/otp/verify", json={"email": user.email, "otp": "654321"})
    token = res.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/auth/me", headers=headers).status_code == 200

    # Simulate what a password reset / "sign out other devices" does.
    user.token_version = (user.token_version or 0) + 1
    db.commit()

    assert client.get("/auth/me", headers=headers).status_code == 401
