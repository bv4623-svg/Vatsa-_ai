"""Startup data fix: conversations saved without a workspace become chats,
once, and code projects are never touched."""
import logging
import uuid

from app import database
from app.models.conversation import Conversation


def _row(db, user_id, workspace):
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id, title=f"ws={workspace!r}", messages=[])
    db.add(conv)
    db.commit()
    db.query(Conversation).filter_by(id=conv.id).update({"workspace": workspace})
    db.commit()
    return conv.id


def _workspace(db, conv_id):
    db.expire_all()
    return db.query(Conversation).filter_by(id=conv_id).one().workspace


def test_empty_workspaces_become_chat_and_code_is_untouched(db, make_user, caplog):
    user, _ = make_user()
    null_row, empty_row = _row(db, user.id, None), _row(db, user.id, "")
    chat_row, code_row = _row(db, user.id, "chat"), _row(db, user.id, "code")

    with caplog.at_level(logging.INFO, logger="Database"):
        changed = database._backfill_conversation_workspace()

    assert changed == 2
    assert [_workspace(db, i) for i in (null_row, empty_row, chat_row, code_row)] == ["chat", "chat", "chat", "code"]
    assert "Backfilled workspace='chat' on 2 conversation(s)" in caplog.text


def test_running_it_again_changes_nothing(db, make_user):
    user, _ = make_user()
    _row(db, user.id, None)
    database._backfill_conversation_workspace()

    assert database._backfill_conversation_workspace() == 0


def test_startup_runs_it(db, make_user):
    user, _ = make_user()
    row = _row(db, user.id, None)

    database.init_db()

    assert _workspace(db, row) == "chat"
