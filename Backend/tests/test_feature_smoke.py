"""Smoke coverage for every other feature in the API: happy path, one
invalid-input case, and cross-user isolation where a resource is owned.
Deeper suites exist for chat, search, images, uploads, research and
payments; this file makes sure nothing else is silently broken."""
import io
import zipfile

import pytest


# ---- platform ---------------------------------------------------------------

def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["intents_loaded"] > 0


def test_security_headers_present(client):
    headers = client.get("/health").headers
    assert headers.get("x-content-type-options") == "nosniff"


def test_intent_classifier(client):
    res = client.post("/api/classify", json={"query": "Fix this Python TypeError and write a unit test"})
    assert res.status_code == 200
    assert res.json()["primary_intent"]["intent"]
    assert client.post("/api/classify", json={"query": "   "}).status_code == 400
    assert client.get("/intents/NOPE").status_code == 404


# ---- auth ---------------------------------------------------------------------

def test_login_rejects_wrong_password(client, make_user):
    user, _ = make_user()
    res = client.post("/auth/login", json={"email": user.email, "password": "wrong-password-123"})
    assert res.status_code in (400, 401)
    assert "hashed" not in res.text


def test_me_requires_valid_token(client, make_user):
    assert client.get("/auth/me").status_code in (401, 403)
    assert client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401
    user, headers = make_user()
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert user.email in me.text
    assert "hashed_password" not in me.text and "totp_secret" not in me.text


def test_settings_roundtrip(client, make_user):
    _, headers = make_user()
    res = client.patch("/auth/settings", json={"responseStyle": "concise"}, headers=headers)
    assert res.status_code == 200, res.text


# ---- conversations ---------------------------------------------------------------

def test_conversation_lifecycle(client, make_user):
    _, h = make_user()
    conv = client.post("/api/conversations", json={"title": "First"}, headers=h).json()
    cid = conv["id"]
    assert client.patch(f"/api/conversations/{cid}", json={"title": "Renamed"}, headers=h).json()["title"] == "Renamed"
    assert client.post(f"/api/conversations/{cid}/pin", headers=h).status_code == 200
    assert client.post(f"/api/conversations/{cid}/favorite", headers=h).status_code == 200
    dup = client.post(f"/api/conversations/{cid}/duplicate", headers=h)
    assert dup.status_code == 200 and dup.json()["id"] != cid
    listed = client.get("/api/conversations", headers=h).json()
    assert {c["id"] for c in listed} >= {cid, dup.json()["id"]}
    assert listed[0]["pinned"] is True
    assert client.delete(f"/api/conversations/{cid}", headers=h).status_code in (200, 204)
    assert client.get(f"/api/conversations/{cid}", headers=h).status_code == 404


def test_conversation_isolation(client, make_user):
    _, owner = make_user()
    _, other = make_user()
    cid = client.post("/api/conversations", json={"title": "secret"}, headers=owner).json()["id"]
    assert client.get(f"/api/conversations/{cid}", headers=other).status_code == 404
    assert client.patch(f"/api/conversations/{cid}", json={"title": "x"}, headers=other).status_code == 404
    assert client.delete(f"/api/conversations/{cid}", headers=other).status_code == 404
    assert all(c["id"] != cid for c in client.get("/api/conversations", headers=other).json())


def test_conversation_workspace_filter(client, make_user):
    _, h = make_user()
    client.post("/api/conversations", json={"title": "c", "workspace": "code"}, headers=h)
    client.post("/api/conversations", json={"title": "t", "workspace": "chat"}, headers=h)
    code = client.get("/api/conversations?workspace=code", headers=h).json()
    assert code and all(c["workspace"] == "code" for c in code)


# ---- memory ---------------------------------------------------------------------------

def test_memory_crud_and_isolation(client, make_user):
    _, h = make_user()
    _, other = make_user()
    created = client.post("/api/memory", json={"content": "Prefers Python", "category": "tech"}, headers=h)
    assert created.status_code == 201, created.text
    mem_id = created.json().get("id") or created.json().get("memory", {}).get("id")
    assert mem_id
    assert "Prefers Python" in client.get("/api/memory", headers=h).text
    assert "Prefers Python" not in client.get("/api/memory", headers=other).text
    assert client.put(f"/api/memory/{mem_id}", json={"content": "Prefers Go"}, headers=other).status_code == 404
    assert client.put(f"/api/memory/{mem_id}", json={"content": "Prefers Go"}, headers=h).status_code == 200
    assert client.delete(f"/api/memory/{mem_id}", headers=h).status_code in (200, 204)


# ---- library ----------------------------------------------------------------------------

def test_library_folders_items_and_share(client, make_user):
    _, h = make_user()
    folder = client.post("/api/library/folders", json={"name": "Docs"}, headers=h)
    assert folder.status_code in (200, 201), folder.text
    client.post("/api/upload", files={"file": ("note.txt", b"hello library", "text/plain")}, headers=h)
    items = client.get("/api/library/items", headers=h).json()
    rows = items.get("items", items) if isinstance(items, dict) else items
    note = next(i for i in rows if i["name"] == "note.txt")
    assert client.patch(f"/api/library/items/{note['id']}", json={"name": "renamed.txt"}, headers=h).status_code == 200
    assert client.get(f"/api/library/items/{note['id']}/download", headers=h).content == b"hello library"
    storage = client.get("/api/library/storage", headers=h).json()
    assert storage.get("used_bytes", 0) >= len(b"hello library")

    share = client.post(f"/api/library/items/{note['id']}/share", headers=h)
    assert share.status_code == 200, share.text
    token = share.json().get("token") or share.json().get("share_token")
    assert token
    assert client.get(f"/api/library/share/{token}").status_code == 200
    assert client.delete(f"/api/library/items/{note['id']}/share", headers=h).status_code in (200, 204)
    assert client.get(f"/api/library/share/{token}").status_code == 404


def test_library_isolation(client, make_user):
    _, owner = make_user()
    _, other = make_user()
    client.post("/api/upload", files={"file": ("mine.txt", b"private", "text/plain")}, headers=owner)
    items = client.get("/api/library/items", headers=owner).json()
    rows = items.get("items", items) if isinstance(items, dict) else items
    item_id = next(i["id"] for i in rows if i["name"] == "mine.txt")
    assert client.get(f"/api/library/items/{item_id}/download", headers=other).status_code == 404
    assert client.delete(f"/api/library/items/{item_id}", headers=other).status_code == 404


# ---- projects ----------------------------------------------------------------------------

def test_projects_lifecycle(client, make_user):
    _, h = make_user(tier="pro")
    proj = client.post("/api/projects", json={"name": "Thesis", "systemPrompt": "Be rigorous."}, headers=h)
    assert proj.status_code in (200, 201), proj.text
    pid = proj.json()["id"]
    cid = client.post("/api/conversations", json={"title": "ch"}, headers=h).json()["id"]
    assert client.post(f"/api/projects/{pid}/chats", json={"conversationId": cid}, headers=h).status_code in (200, 201)
    assert client.patch(f"/api/projects/{pid}", json={"name": "Thesis v2"}, headers=h).status_code == 200
    assert client.post(f"/api/projects/{pid}/archive", headers=h).status_code == 200
    assert client.post(f"/api/projects/{pid}/unarchive", headers=h).status_code == 200
    assert client.delete(f"/api/projects/{pid}", headers=h).status_code in (200, 204)
    # Deleting a project detaches its chats rather than deleting them.
    assert client.get(f"/api/conversations/{cid}", headers=h).status_code == 200


def test_projects_validation_and_isolation(client, make_user):
    _, h = make_user(tier="pro")
    _, other = make_user(tier="pro")
    assert client.post("/api/projects", json={"name": ""}, headers=h).status_code == 422
    pid = client.post("/api/projects", json={"name": "Mine"}, headers=h).json()["id"]
    assert client.get(f"/api/projects/{pid}", headers=other).status_code == 404


# ---- scheduled tasks ---------------------------------------------------------------------

def test_scheduled_tasks_lifecycle(client, make_user):
    _, h = make_user(tier="pro")
    res = client.post("/api/scheduled-tasks", json={"title": "Daily digest", "prompt": "Summarise AI news", "schedule": "0 9 * * *"}, headers=h)
    assert res.status_code in (200, 201), res.text
    tid = res.json()["id"]
    assert client.post(f"/api/scheduled-tasks/{tid}/pause", headers=h).status_code == 200
    assert client.post(f"/api/scheduled-tasks/{tid}/resume", headers=h).status_code == 200
    assert client.patch(f"/api/scheduled-tasks/{tid}", json={"title": "Morning digest"}, headers=h).status_code == 200
    assert client.delete(f"/api/scheduled-tasks/{tid}", headers=h).status_code in (200, 204)


def test_scheduled_tasks_reject_bad_cron(client, make_user):
    _, h = make_user(tier="pro")
    res = client.post("/api/scheduled-tasks", json={"title": "x", "prompt": "y", "schedule": "not a cron!"}, headers=h)
    assert res.status_code in (400, 422)


# ---- account --------------------------------------------------------------------------------

def test_account_export_contains_own_data_only(client, make_user):
    _, h = make_user()
    _, other = make_user()
    client.post("/api/conversations", json={"title": "export-me"}, headers=h)
    client.post("/api/conversations", json={"title": "not-mine"}, headers=other)
    res = client.get("/api/account/export", headers=h)
    assert res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        dump = "".join(zf.read(n).decode("utf-8", "replace") for n in zf.namelist())
    assert "profile.json" in res.content.decode("latin-1")
    assert "export-me" in dump and "not-mine" not in dump
    assert "hashed_password" not in dump and "totp_secret" not in dump


def test_api_keys_are_a_paid_feature(client, make_user):
    """Same 402 upgrade_required contract as every other plan gate (BUG-025),
    so the frontend's shared upgrade handler recognises it."""
    _, free = make_user()
    res = client.post("/api/account/api-keys", json={"name": "ci"}, headers=free)
    assert res.status_code == 402
    assert res.json()["detail"] == {
        "error": "upgrade_required", "feature": "api_keys", "current_tier": "free",
        "suggested_tier": "pro", "upgrade_url": "/pricing",
    }


def test_api_keys_create_list_revoke(client, make_user):
    _, h = make_user(tier="pro")
    created = client.post("/api/account/api-keys", json={"name": "ci"}, headers=h)
    assert created.status_code in (200, 201), created.text
    body = created.json()
    key_id = body.get("id")
    listed = client.get("/api/account/api-keys", headers=h).text
    secret = body.get("key") or body.get("api_key") or body.get("token")
    if secret:
        assert secret not in listed, "the full key must only be shown once"
    assert client.delete(f"/api/account/api-keys/{key_id}", headers=h).status_code in (200, 204)


def test_api_key_authenticates_until_revoked(client, make_user):
    user, h = make_user(tier="pro")
    created = client.post("/api/account/api-keys", json={"name": "script"}, headers=h).json()
    key_headers = {"Authorization": f"Bearer {created['key']}"}
    me = client.get("/api/conversations", headers=key_headers)
    assert me.status_code == 200
    client.delete(f"/api/account/api-keys/{created['id']}", headers=h)
    assert client.get("/api/conversations", headers=key_headers).status_code == 401
    # A made-up key with the right prefix is rejected too.
    assert client.get("/api/conversations", headers={"Authorization": "Bearer vsk_notreal"}).status_code == 401


def test_notifications_and_tokens(client, make_user):
    _, h = make_user()
    assert client.get("/api/account/notifications", headers=h).status_code == 200
    assert client.post("/api/account/notifications/read-all", headers=h).status_code == 200
    bal = client.get("/api/tokens/balance", headers=h)
    assert bal.status_code == 200
    assert client.get("/api/tokens/transactions", headers=h).status_code == 200


def test_admin_endpoint_refuses_normal_users(client, make_user):
    _, h = make_user()
    assert client.get("/api/admin/payments?email=x@example.com", headers=h).status_code in (401, 403, 404)


@pytest.mark.parametrize("path", ["/api/profile", "/api/account/billing", "/api/payments/me"])
def test_authenticated_reads(client, make_user, path):
    _, h = make_user()
    assert client.get(path).status_code in (401, 403)
    assert client.get(path, headers=h).status_code == 200


def test_production_password_hashing_uses_cost_12():
    """The test fixture uses a cheap precomputed hash for speed; production
    hashing must stay at bcrypt cost 12."""
    from app.auth.jwt import get_password_hash, verify_password
    hashed = get_password_hash("correct horse battery staple")
    assert hashed.startswith("$2b$12$")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong", hashed)
