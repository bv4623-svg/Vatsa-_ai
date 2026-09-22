"""POST /auth/otp/send and /auth/otp/resend must refuse a second request for
the same email+purpose inside RESEND_COOLDOWN_SECONDS, independent of the
5-per-10-minute cap (that only stops sustained abuse, not someone
double-clicking "resend"). See app/routers/auth/otp.py."""
from app.routers.auth.otp import RESEND_COOLDOWN_SECONDS


def test_second_send_within_the_cooldown_window_is_rejected(client):
    email = "cooldown-target@example.com"
    first = client.post("/auth/otp/send", json={"email": email, "purpose": "login"})
    # The test environment has no EMAIL_USERNAME/PASSWORD configured, so the
    # first call 503s before ever reaching real SMTP -- but the cooldown key
    # is written earlier than that (see otp.py), so it's still in effect.
    assert first.status_code == 503

    second = client.post("/auth/otp/send", json={"email": email, "purpose": "login"})
    assert second.status_code == 429
    assert "Retry-After" in second.headers
    assert int(second.headers["Retry-After"]) <= RESEND_COOLDOWN_SECONDS


def test_cooldown_is_scoped_per_email_and_purpose(client):
    client.post("/auth/otp/send", json={"email": "a@example.com", "purpose": "login"})

    # A different email is unaffected by the first one's cooldown.
    other_email = client.post("/auth/otp/send", json={"email": "b@example.com", "purpose": "login"})
    assert other_email.status_code == 503  # blocked by missing email config, not the cooldown

    # A different purpose for the SAME email is also unaffected.
    other_purpose = client.post("/auth/otp/send", json={"email": "a@example.com", "purpose": "signup"})
    assert other_purpose.status_code == 503
