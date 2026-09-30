"""POST /auth/otp/send and /auth/otp/resend must refuse a second request for
the same email inside RESEND_COOLDOWN_SECONDS, independent of the
5-per-10-minute cap (that only stops sustained abuse, not someone
double-clicking "resend"). "reset" is the only surviving purpose -- sign-up
and OTP-based login were removed alongside email/password registration
(see app/routers/auth/core.py:register, app/routers/auth/otp.py)."""
from app.routers.auth.otp import RESEND_COOLDOWN_SECONDS


def test_second_send_within_the_cooldown_window_is_rejected(client):
    email = "cooldown-target@example.com"
    first = client.post("/auth/otp/send", json={"email": email, "purpose": "reset"})
    # The test environment has no EMAIL_USERNAME/PASSWORD configured, so the
    # first call 503s before ever reaching real SMTP -- but the cooldown key
    # is written earlier than that (see otp.py), so it's still in effect.
    assert first.status_code == 503

    second = client.post("/auth/otp/send", json={"email": email, "purpose": "reset"})
    assert second.status_code == 429
    assert "Retry-After" in second.headers
    assert int(second.headers["Retry-After"]) <= RESEND_COOLDOWN_SECONDS


def test_cooldown_is_scoped_per_email(client):
    client.post("/auth/otp/send", json={"email": "a@example.com", "purpose": "reset"})

    # A different email is unaffected by the first one's cooldown.
    other_email = client.post("/auth/otp/send", json={"email": "b@example.com", "purpose": "reset"})
    assert other_email.status_code == 503  # blocked by missing email config, not the cooldown


def test_any_purpose_other_than_reset_is_rejected_before_the_cooldown_check(client):
    for purpose in ("signup", "login", ""):
        res = client.post("/auth/otp/send", json={"email": "c@example.com", "purpose": purpose})
        assert res.status_code == 410, res.text
