"""Chats and code projects share the conversations table, split by the
`workspace` column. Clearing one workspace must never touch the other."""
import uuid

from app.models.conversation import Conversation


def _new(client, headers, workspace):
    res = client.post("/api/conversations", json={"title": workspace, "workspace": workspace}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _legacy_chat(db, user_id):
    """A row saved before the workspace column was always filled in."""
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id, title="old chat", messages=[])
    db.add(conv)
    db.commit()
    db.query(Conversation).filter_by(id=conv.id).update({"workspace": None})
    db.commit()
    return conv.id


def _ids(db, user_id):
    db.expire_all()
    return {c.id for c in db.query(Conversation).filter_by(user_id=user_id).all()}


def test_clear_all_chats_keeps_code_projects(client, db, make_user):
    user, headers = make_user("pro")
    chats = {_new(client, headers, "chat"), _new(client, headers, "chat"), _legacy_chat(db, user.id)}
    code = _new(client, headers, "code")

    res = client.delete("/api/conversations?workspace=chat", headers=headers)

    assert res.status_code == 200
    assert res.json()["deleted"] == len(chats)
    assert _ids(db, user.id) == {code}


def test_delete_all_without_a_workspace_only_clears_chats(client, db, make_user):
    # The frontend already in production calls DELETE /api/conversations
    # with no query string; that request must not reach code projects.
    user, headers = make_user("pro")
    _new(client, headers, "chat")
    code = _new(client, headers, "code")

    assert client.delete("/api/conversations", headers=headers).status_code == 200
    assert _ids(db, user.id) == {code}


def test_clearing_code_projects_keeps_chats(client, db, make_user):
    user, headers = make_user("pro")
    chat = _new(client, headers, "chat")
    legacy = _legacy_chat(db, user.id)
    _new(client, headers, "code")

    assert client.delete("/api/conversations?workspace=code", headers=headers).status_code == 200
    assert _ids(db, user.id) == {chat, legacy}


def test_chat_list_includes_rows_saved_without_a_workspace(client, db, make_user):
    user, headers = make_user("pro")
    chat = _new(client, headers, "chat")
    legacy = _legacy_chat(db, user.id)
    code = _new(client, headers, "code")

    chat_ids = {c["id"] for c in client.get("/api/conversations?workspace=chat", headers=headers).json()}
    code_ids = {c["id"] for c in client.get("/api/conversations?workspace=code", headers=headers).json()}

    assert chat_ids == {chat, legacy}
    assert code_ids == {code}


def test_clearing_chats_leaves_other_users_alone(client, db, make_user):
    me, my_headers = make_user("pro")
    other, other_headers = make_user("pro")
    theirs = {_new(client, other_headers, "chat"), _new(client, other_headers, "code")}
    _new(client, my_headers, "chat")

    assert client.delete("/api/conversations", headers=my_headers).status_code == 200
    assert _ids(db, other.id) == theirs
