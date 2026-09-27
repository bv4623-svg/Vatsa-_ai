"""Database access patterns: hot queries use an index (no full-table scan),
and list endpoints issue a constant number of statements however many rows
the user has (no N+1)."""
import re
from contextlib import contextmanager

import pytest
from sqlalchemy import event

from app.database import engine

HOT_QUERIES = {
    "conversations list": "SELECT * FROM conversations WHERE user_id=1 AND workspace='code' ORDER BY pinned DESC, updated_at DESC",
    "conversation get": "SELECT * FROM conversations WHERE id='c' AND user_id=1",
    "daily usage": "SELECT * FROM usage_daily WHERE user_id=1 AND feature='chat_messages' AND date='2026-01-01'",
    "token account": "SELECT * FROM token_accounts WHERE user_id=1",
    "token transactions": "SELECT * FROM token_transactions WHERE user_id=1 ORDER BY created_at DESC LIMIT 50",
    "library list": "SELECT * FROM library_items WHERE user_id=1",
    "memories": "SELECT * FROM memories WHERE user_id=1",
    "generated image": "SELECT * FROM generated_images WHERE id='x'",
    "api key auth": "SELECT * FROM api_keys WHERE key_hash='h'",
    "user by email": "SELECT * FROM users WHERE email='a@b.c'",
    "payments": "SELECT * FROM payments WHERE user_id=1",
    "otp": "SELECT * FROM otps WHERE email='a@b.c' AND purpose='signup'",
    "scheduled tasks": "SELECT * FROM scheduled_tasks WHERE user_id=1",
    "projects": "SELECT * FROM chat_projects WHERE user_id=1",
    "notifications": "SELECT * FROM notifications WHERE user_id=1 ORDER BY created_at DESC",
}


@pytest.mark.parametrize("name", HOT_QUERIES)
def test_hot_query_uses_an_index(client, name):
    with engine.connect() as conn:
        plan = [row[3] for row in conn.exec_driver_sql("EXPLAIN QUERY PLAN " + HOT_QUERIES[name])]
    table_access = [p for p in plan if p.startswith(("SCAN", "SEARCH"))]
    assert table_access and all(p.startswith("SEARCH") for p in table_access), f"{name}: {plan}"


@contextmanager
def count_statements():
    counter = {"n": 0}

    def _count(conn, cursor, statement, params, context, executemany):
        if re.match(r"\s*(SELECT|INSERT|UPDATE|DELETE)", statement, re.I):
            counter["n"] += 1

    event.listen(engine, "before_cursor_execute", _count)
    try:
        yield counter
    finally:
        event.remove(engine, "before_cursor_execute", _count)


def _statements_for(client, headers, path):
    with count_statements() as c:
        assert client.get(path, headers=headers).status_code == 200
    return c["n"]


@pytest.mark.parametrize("path,create", [
    ("/api/conversations", lambda c, h, i: c.post("/api/conversations", json={"title": f"c{i}"}, headers=h)),
    ("/api/projects", lambda c, h, i: c.post("/api/projects", json={"name": f"p{i}"}, headers=h)),
    ("/api/library/items", lambda c, h, i: c.post("/api/upload", files={"file": (f"f{i}.txt", b"x", "text/plain")}, headers=h)),
    ("/api/memory", lambda c, h, i: c.post("/api/memory", json={"content": f"fact {i}"}, headers=h)),
    ("/api/scheduled-tasks", lambda c, h, i: c.post("/api/scheduled-tasks", json={"title": f"t{i}", "prompt": "p", "schedule": "0 9 * * *"}, headers=h)),
])
def test_list_endpoints_have_no_n_plus_1(client, make_user, path, create):
    _, headers = make_user(tier="pro")
    for i in range(2):
        assert create(client, headers, i).status_code in (200, 201)
    few = _statements_for(client, headers, path)
    for i in range(2, 20):
        assert create(client, headers, i).status_code in (200, 201)
    many = _statements_for(client, headers, path)
    assert many <= few, f"{path}: {few} statements for 2 rows but {many} for 20 (N+1)"


def test_project_list_still_reports_each_projects_chats_and_files(client, make_user):
    _, h = make_user(tier="pro")
    p1 = client.post("/api/projects", json={"name": "one"}, headers=h).json()["id"]
    p2 = client.post("/api/projects", json={"name": "two"}, headers=h).json()["id"]
    c1 = client.post("/api/conversations", json={"title": "a"}, headers=h).json()["id"]
    c2 = client.post("/api/conversations", json={"title": "b"}, headers=h).json()["id"]
    client.post(f"/api/projects/{p1}/chats", json={"conversationId": c1}, headers=h)
    client.post(f"/api/projects/{p1}/chats", json={"conversationId": c2}, headers=h)
    client.post("/api/upload", files={"file": ("doc.txt", b"x", "text/plain")}, headers=h)
    items = client.get("/api/library/items", headers=h).json()
    rows = items.get("items", items) if isinstance(items, dict) else items
    file_id = next(i["id"] for i in rows if i["name"] == "doc.txt")
    client.post(f"/api/projects/{p2}/files", json={"itemId": file_id}, headers=h)

    listed = {p["id"]: p for p in client.get("/api/projects", headers=h).json()["items"]}
    assert sorted(listed[p1]["chatIds"]) == sorted([c1, c2]) and listed[p1]["fileIds"] == []
    assert listed[p2]["chatIds"] == [] and listed[p2]["fileIds"] == [file_id]
