"""POST /api/feedback (signed in or not), GET/PATCH /api/feedback (admin only)."""
import pytest

from app.models.feedback import Feedback
from app.models.user import User

GOOD = {"type": "bug", "message": "The send button does nothing on Safari.", "rating": 3, "page_url": "https://vatsaai.com/home"}

_admins = {"n": 0}


@pytest.fixture(autouse=True)
def fresh_feedback_rate_limit():
    from app.utils import rate_limit
    for key in [k for k in rate_limit._buckets if k.startswith(("feedback:", "admin-feedback:"))]:
        rate_limit.reset_rate_limit(key)


@pytest.fixture()
def admin(db, make_user, monkeypatch):
    _admins["n"] += 1
    address = f"feedback-admin{_admins['n']}@example.com"
    user, headers = make_user(email=address)
    monkeypatch.setenv("ADMIN_EMAILS", address)
    db.expire_all()
    db.get(User, user.id).two_factor_enabled = True
    db.commit()
    return headers


# ── submitting ────────────────────────────────────────────────────────

def test_signed_in_feedback_is_saved_against_the_account(client, db, make_user):
    user, headers = make_user()
    res = client.post("/api/feedback", json=GOOD, headers={**headers, "User-Agent": "UnitTest/1.0"})
    assert res.status_code == 201, res.text
    row = db.get(Feedback, res.json()["id"])
    assert (row.user_id, row.email, row.type, row.rating, row.status) == (user.id, user.email, "bug", 3, "new")
    assert row.page_url == GOOD["page_url"] and row.user_agent == "UnitTest/1.0"


def test_signed_out_feedback_is_saved_with_an_optional_email(client, db):
    res = client.post("/api/feedback", json={**GOOD, "type": "praise", "email": "Fan@Example.com", "rating": None})
    assert res.status_code == 201, res.text
    row = db.get(Feedback, res.json()["id"])
    assert row.user_id is None and row.email.lower() == "fan@example.com" and row.rating is None

    anonymous = client.post("/api/feedback", json={"type": "other", "message": "No email this time, just saying hi."})
    assert anonymous.status_code == 201


@pytest.mark.parametrize("patch", [
    {"message": "too short"},                  # 9 characters
    {"message": "   short    "},               # whitespace doesn't count
    {"message": "x" * 5001},
    {"type": "complaint"},
    {"rating": 0},
    {"rating": 6},
    {"email": "not-an-email"},
    {"page_url": "javascript:alert(1)"},
])
def test_invalid_feedback_is_rejected(client, patch):
    assert client.post("/api/feedback", json={**GOOD, **patch}).status_code == 422


def test_message_limits_are_inclusive(client, make_user):
    _, headers = make_user()
    assert client.post("/api/feedback", json={**GOOD, "message": "x" * 10}, headers=headers).status_code == 201
    assert client.post("/api/feedback", json={**GOOD, "message": "x" * 5000}, headers=headers).status_code == 201


def test_a_user_can_send_five_a_day(client, make_user):
    _, headers = make_user()
    for _ in range(5):
        assert client.post("/api/feedback", json=GOOD, headers=headers).status_code == 201
    res = client.post("/api/feedback", json=GOOD, headers=headers)
    assert res.status_code == 429 and "5 feedback" in res.json()["detail"]

    _, someone_else = make_user()
    assert client.post("/api/feedback", json=GOOD, headers=someone_else).status_code == 201


def test_signed_out_senders_are_limited_per_ip(client):
    for _ in range(5):
        assert client.post("/api/feedback", json=GOOD).status_code == 201
    assert client.post("/api/feedback", json=GOOD).status_code == 429


# ── admin ─────────────────────────────────────────────────────────────

def test_listing_and_updating_need_an_admin(client, make_user):
    _, headers = make_user()
    fid = client.post("/api/feedback", json=GOOD, headers=headers).json()["id"]
    for h in ({}, headers):
        assert client.get("/api/feedback", headers=h).status_code in (401, 403)
        assert client.patch(f"/api/feedback/{fid}", json={"status": "read"}, headers=h).status_code in (401, 403)


def test_admin_without_two_factor_is_refused(client, db, make_user, monkeypatch):
    user, headers = make_user(email="feedback-no2fa@example.com")
    monkeypatch.setenv("ADMIN_EMAILS", user.email)
    assert client.get("/api/feedback", headers=headers).status_code == 403


def test_admin_lists_newest_first_and_filters(client, make_user, admin):
    _, headers = make_user()
    bug = client.post("/api/feedback", json={**GOOD, "message": "Bug report number one here."}, headers=headers).json()["id"]
    idea = client.post("/api/feedback", json={**GOOD, "type": "feature", "message": "Please add dark mode export."}, headers=headers).json()["id"]

    body = client.get("/api/feedback?limit=200", headers=admin).json()
    ids = [item["id"] for item in body["items"]]
    assert ids.index(idea) < ids.index(bug)
    assert body["counts"]["new"] >= 2

    features = client.get("/api/feedback?type=feature&limit=200", headers=admin).json()["items"]
    assert idea in [f["id"] for f in features] and all(f["type"] == "feature" for f in features)
    assert client.get("/api/feedback?status=bogus", headers=admin).status_code == 422


def test_admin_marks_feedback_read_and_resolved(client, make_user, admin):
    _, headers = make_user()
    fid = client.post("/api/feedback", json=GOOD, headers=headers).json()["id"]

    for status in ("read", "resolved"):
        res = client.patch(f"/api/feedback/{fid}", json={"status": status}, headers=admin)
        assert res.status_code == 200 and res.json()["status"] == status

    resolved = client.get("/api/feedback?status=resolved&limit=200", headers=admin).json()["items"]
    assert fid in [f["id"] for f in resolved]
    assert client.patch(f"/api/feedback/{fid}", json={"status": "archived"}, headers=admin).status_code == 422
    assert client.patch("/api/feedback/999999", json={"status": "read"}, headers=admin).status_code == 404
