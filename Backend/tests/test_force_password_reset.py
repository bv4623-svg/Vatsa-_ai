"""scripts/force_password_reset.py on fake users: only accounts older than the
leak are touched; their sessions and old password stop working; the normal
reset flow gets them back in; notification emails go to them only."""
from datetime import datetime

from conftest import TEST_PASSWORD
from app.database import SessionLocal
from app.models.user import User
from scripts import force_password_reset as fpr
from test_password_reset import NEW_PASSWORD, outbox, _otp  # noqa: F401 (fixture)


def _age(user_id, created):
    db = SessionLocal()
    try:
        db.query(User).filter_by(id=user_id).update({"created_at": created})
        db.commit()
    finally:
        db.close()


def test_force_reset_only_hits_accounts_older_than_the_leak(client, make_user, outbox):  # noqa: F811
    old, old_session = make_user()
    new, new_session = make_user()
    _age(old.id, datetime(2026, 9, 10, 12, 0))
    _age(new.id, datetime(2026, 9, 20, 12, 0))

    db = SessionLocal()
    try:
        affected = fpr.affected_users(db)
        emails = [u.email for u in affected]
        assert old.email in emails and new.email not in emails

        sent = []
        result = fpr.force_reset(db, [u for u in affected if u.email == old.email],
                                 notify=lambda to, title, msg: sent.append((to, title, msg)) or True,
                                 frontend_url="https://app.example")
    finally:
        db.close()

    assert result == {"reset": 1, "notified": 1, "notify_failed": 0}
    assert sent[0][0] == old.email and "https://app.example/forgot-password" in sent[0][2]
    assert TEST_PASSWORD not in sent[0][2]

    # The affected user is signed out and the old password no longer works...
    assert client.get("/auth/me", headers=old_session).status_code == 401
    assert client.post("/auth/login", json={"email": old.email, "password": TEST_PASSWORD}).status_code == 400
    # ...the newer account is untouched...
    assert client.get("/auth/me", headers=new_session).status_code == 200
    # ...and the normal reset flow gets the affected user back in.
    code = _otp(client, outbox, old.email, "reset")
    token = client.post("/auth/otp/verify", json={"email": old.email, "otp": code}).json()["reset_token"]
    assert client.post("/auth/reset-password", json={"email": old.email, "reset_token": token, "password": NEW_PASSWORD}).status_code == 200
    assert client.post("/auth/login", json={"email": old.email, "password": NEW_PASSWORD}).status_code == 200


def test_dry_run_lists_without_changing_anything(client, make_user, capsys):
    old, old_session = make_user()
    _age(old.id, datetime(2026, 9, 1))
    assert fpr.main([]) == 0
    out = capsys.readouterr().out
    assert old.email in out and "Dry run" in out
    assert client.get("/auth/me", headers=old_session).status_code == 200


def test_failed_notification_is_counted(make_user):
    old, _ = make_user()
    _age(old.id, datetime(2026, 9, 2))
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(id=old.id).first()
        result = fpr.force_reset(db, [user], notify=lambda *a: False)
    finally:
        db.close()
    assert result["notify_failed"] == 1
