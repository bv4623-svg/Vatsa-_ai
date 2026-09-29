"""POST /api/contact: a public, unauthenticated endpoint that stores every
submission as a real row (the durable record) and best-effort sends a
notification email on top of it. See app/routers/contact.py,
app/models/contact.py."""
from unittest.mock import patch

from app.models.contact import ContactMessage


def _payload(**overrides):
    payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "interest": "API Integration",
        "message": "I'd like to know more about the API.",
    }
    payload.update(overrides)
    return payload


def test_valid_submission_creates_a_row_and_returns_success(client, db):
    with patch("app.routers.contact._send", return_value=True) as mock_send:
        res = client.post("/api/contact", json=_payload())
    assert res.status_code == 200, res.text
    assert res.json() == {"success": True}

    row = db.query(ContactMessage).filter_by(email="ada@example.com").first()
    assert row is not None
    assert row.name == "Ada Lovelace"
    assert row.interest == "API Integration"
    assert row.message == "I'd like to know more about the API."
    mock_send.assert_called_once()


def test_row_is_created_even_when_the_notification_email_fails(client, db):
    """The DB row is the source of truth -- a broken/unconfigured SMTP
    setup must not silently drop the visitor's message."""
    with patch("app.routers.contact._send", return_value=False):
        res = client.post("/api/contact", json=_payload(email="unset-smtp@example.com"))
    assert res.status_code == 200, res.text
    assert db.query(ContactMessage).filter_by(email="unset-smtp@example.com").first() is not None


def test_missing_required_field_is_rejected(client):
    with patch("app.routers.contact._send", return_value=True):
        res = client.post("/api/contact", json=_payload(message=""))
    assert res.status_code == 422


def test_invalid_email_is_rejected(client):
    with patch("app.routers.contact._send", return_value=True):
        res = client.post("/api/contact", json=_payload(email="not-an-email"))
    assert res.status_code == 422


def test_interest_is_optional(client, db):
    with patch("app.routers.contact._send", return_value=True):
        res = client.post("/api/contact", json=_payload(email="no-interest@example.com", interest=None))
    assert res.status_code == 200, res.text
    row = db.query(ContactMessage).filter_by(email="no-interest@example.com").first()
    assert row.interest is None


def test_repeated_submissions_from_the_same_ip_are_rate_limited(client):
    with patch("app.routers.contact._send", return_value=True):
        for i in range(5):
            res = client.post("/api/contact", json=_payload(email=f"spam{i}@example.com"))
            assert res.status_code == 200, res.text
        blocked = client.post("/api/contact", json=_payload(email="spam-blocked@example.com"))
    assert blocked.status_code == 429
