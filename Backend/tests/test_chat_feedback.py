"""👍/👎 on assistant replies are saved (Phase 0 Fix 3): POST/DELETE/GET
/api/chat/feedback, the reply id the browser needs, cleanup with the
conversation and the account, and admin stats at
/api/admin/chat-feedback/stats. See routers/chat_feedback.py."""
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.models.chat_feedback import ChatFeedback
from app.models.conversation import Conversation
from app.models.user import User
from llm_fakes import fake_llm  # noqa: F401  (fixture)

_admins = {"n": 0}


def new_chat(client, headers):
    res = client.post("/api/conversations", json={"title": "Feedback test"}, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


def reply(client, headers, conv_id=None, stream=False):
    """Sends a message through the real chat endpoint (fake model) and
    returns (conversation_id, the id the browser gets for the reply)."""
    conv_id = conv_id or new_chat(client, headers)
    res = client.post("/api/chat", json={"message": "hello", "conversation_id": conv_id, "stream": stream}, headers=headers)
    assert res.status_code == 200, res.text
    if not stream:
        return conv_id, res.json()["message_id"]
    events = [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")]
    done = next(e for e in events if e.get("done"))
    return conv_id, done["message_id"]


def vote(client, headers, conv_id, msg_id, rating, reason=None):
    return client.post("/api/chat/feedback", json={"conversation_id": conv_id, "message_id": msg_id, "rating": rating, "reason": reason}, headers=headers)


def mine(client, headers, conv_id):
    res = client.get(f"/api/chat/feedback?conversation_id={conv_id}", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["items"]


def make_admin(db, make_user, monkeypatch):
    _admins["n"] += 1
    address = f"chatfb-admin{_admins['n']}@example.com"
    admin, headers = make_user(email=address)
    monkeypatch.setenv("ADMIN_EMAILS", address)
    db.expire_all()
    db.get(User, admin.id).two_factor_enabled = True
    db.commit()
    return headers


@pytest.mark.parametrize("stream", [False, True])
def test_the_browser_gets_the_id_the_reply_was_saved_under(client, db, make_user, fake_llm, stream):
    _, headers = make_user()
    conv_id, msg_id = reply(client, headers, stream=stream)
    db.expire_all()
    saved = db.get(Conversation, conv_id).messages
    assert msg_id and msg_id.startswith("msg_")
    assert [m["id"] for m in saved if m["role"] == "assistant"] == [msg_id]


def test_with_auto_save_off_there_is_no_saved_reply_to_rate(client, db, make_user, fake_llm):
    user, headers = make_user()
    db.get(User, user.id).settings = {"autoSaveChats": False}
    db.commit()
    _, msg_id = reply(client, headers)
    assert msg_id is None


def test_vote_change_and_clear(client, make_user, fake_llm):
    _, headers = make_user()
    conv_id, msg_id = reply(client, headers)

    assert vote(client, headers, conv_id, msg_id, "up").json() == {"conversation_id": conv_id, "message_id": msg_id, "rating": "up", "reason": None}
    res = vote(client, headers, conv_id, msg_id, "down", "too_long")
    assert res.status_code == 200 and res.json()["reason"] == "too_long"
    assert mine(client, headers, conv_id) == [{"conversation_id": conv_id, "message_id": msg_id, "rating": "down", "reason": "too_long"}]
    # A reason belongs to a thumbs-down only.
    assert vote(client, headers, conv_id, msg_id, "up", "wrong").json()["reason"] is None
    assert len(mine(client, headers, conv_id)) == 1  # updated, not duplicated

    cleared = client.delete(f"/api/chat/feedback?conversation_id={conv_id}&message_id={msg_id}", headers=headers)
    assert cleared.status_code == 200 and cleared.json()["rating"] is None
    assert mine(client, headers, conv_id) == []


def test_votes_need_a_login(client):
    assert client.post("/api/chat/feedback", json={"conversation_id": "c", "message_id": "m", "rating": "up"}).status_code in (401, 403)
    assert client.get("/api/chat/feedback?conversation_id=c").status_code in (401, 403)
    assert client.delete("/api/chat/feedback?conversation_id=c&message_id=m").status_code in (401, 403)


def test_only_your_own_saved_replies_can_be_rated(client, db, make_user, fake_llm):
    _, owner = make_user()
    _, stranger = make_user()
    conv_id, msg_id = reply(client, owner)
    user_msg_id = next(m["id"] for m in db.get(Conversation, conv_id).messages if m["role"] == "user")

    assert vote(client, stranger, conv_id, msg_id, "down").status_code == 404      # someone else's chat
    assert vote(client, owner, conv_id, user_msg_id, "up").status_code == 404      # your own message, not a reply
    assert vote(client, owner, conv_id, "msg_nothere", "up").status_code == 404
    assert mine(client, stranger, conv_id) == []
    assert db.query(ChatFeedback).filter_by(conversation_id=conv_id).count() == 0


def test_bad_rating_or_reason_is_rejected(client, make_user, fake_llm):
    _, headers = make_user()
    conv_id, msg_id = reply(client, headers)
    assert vote(client, headers, conv_id, msg_id, "meh").status_code == 422
    assert vote(client, headers, conv_id, msg_id, "down", "my phone number is 98765").status_code == 422


def test_voting_is_rate_limited(client, make_user, fake_llm):
    _, headers = make_user()
    conv_id, msg_id = reply(client, headers)
    codes = [vote(client, headers, conv_id, msg_id, "up" if i % 2 else "down").status_code for i in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429


def test_votes_go_with_the_conversation_and_the_account(client, db, make_user, fake_llm):
    user, headers = make_user()
    one, m1 = reply(client, headers)
    two, m2 = reply(client, headers)
    vote(client, headers, one, m1, "up")
    vote(client, headers, two, m2, "down")

    assert client.delete(f"/api/conversations/{one}", headers=headers).status_code == 200
    assert db.query(ChatFeedback).filter_by(conversation_id=one).count() == 0
    assert db.query(ChatFeedback).filter_by(conversation_id=two).count() == 1
    assert client.delete("/api/conversations", headers=headers).status_code == 200
    assert db.query(ChatFeedback).filter_by(user_id=user.id).count() == 0

    three, m3 = reply(client, headers)
    vote(client, headers, three, m3, "up")
    from app.services.account.deletion import _cascade_delete_user
    _cascade_delete_user(db, user.id)
    assert db.query(ChatFeedback).filter_by(user_id=user.id).count() == 0


def test_history_retention_takes_the_votes_too(client, db, make_user, fake_llm, monkeypatch):
    user, headers = make_user()
    conv_id, msg_id = reply(client, headers)
    vote(client, headers, conv_id, msg_id, "up")
    db.expire_all()
    db.get(User, user.id).settings = {"historyRetention": "30d"}
    db.get(Conversation, conv_id).updated_at = datetime.now(timezone.utc) - timedelta(days=45)
    db.commit()
    from app.services.account import retention
    monkeypatch.setattr(retention, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    retention.enforce_history_retention()
    assert db.query(ChatFeedback).filter_by(conversation_id=conv_id).count() == 0


def test_admin_stats(client, db, make_user, fake_llm, monkeypatch):
    _, headers = make_user()
    conv_id, msg_id = reply(client, headers)
    db.query(ChatFeedback).delete()  # stats are global; start from a clean slate
    db.commit()
    user_id = db.get(Conversation, conv_id).user_id
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rows = [("up", None, 0), ("up", None, 0), ("down", "too_long", 0), ("down", "too_long", 2), ("down", "wrong", 2), ("down", None, 2), ("up", None, 40)]
    for i, (rating, reason, ago) in enumerate(rows):
        db.add(ChatFeedback(user_id=user_id, conversation_id=conv_id, message_id=f"msg_seed{i}", rating=rating, reason=reason, created_at=now - timedelta(days=ago)))
    db.commit()

    assert client.get("/api/admin/chat-feedback/stats", headers=headers).status_code == 403
    admin = make_admin(db, make_user, monkeypatch)
    body = client.get("/api/admin/chat-feedback/stats?days=30", headers=admin).json()

    assert (body["total"], body["up"], body["down"]) == (6, 2, 4)  # the 40-day-old vote is outside the window
    assert body["satisfaction"] == round(2 / 6, 3)
    assert body["top_reasons"] == [{"reason": "too_long", "count": 2}, {"reason": "wrong", "count": 1}]
    assert body["down_without_reason"] == 1
    assert len(body["by_day"]) == 30
    by_date = {d["date"]: d for d in body["by_day"]}
    assert by_date[now.date().isoformat()] == {"date": now.date().isoformat(), "up": 2, "down": 1}
    two_ago = (now - timedelta(days=2)).date().isoformat()
    assert by_date[two_ago] == {"date": two_ago, "up": 0, "down": 3}
