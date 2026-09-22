"""User A must never be able to read, modify or delete User B's data.

Every endpoint below is exercised over real HTTP through the TestClient,
using two genuinely separate accounts each signed in through the real
POST /auth/login -- not by inspecting the route source. Ownership is
enforced by filtering every query on the AUTHENTICATED user's id (from
get_current_user), never a client-supplied id; these tests are what
proves that holds at the HTTP boundary, not just in the code.
"""


def test_conversations_are_isolated_between_users(client, make_user):
    owner, owner_headers = make_user()
    other, other_headers = make_user()

    created = client.post("/api/conversations", json={"title": "Owner's chat"}, headers=owner_headers)
    assert created.status_code == 200
    conv_id = created.json()["id"]

    # Other user can't see it in their list.
    listing = client.get("/api/conversations", headers=other_headers)
    assert conv_id not in [c["id"] for c in listing.json()]

    # Other user can't read, update, or delete it directly.
    assert client.get(f"/api/conversations/{conv_id}", headers=other_headers).status_code == 404
    assert client.patch(f"/api/conversations/{conv_id}", json={"title": "hijacked"}, headers=other_headers).status_code == 404
    assert client.delete(f"/api/conversations/{conv_id}", headers=other_headers).status_code == 404

    # It's untouched and still readable by its real owner.
    mine = client.get(f"/api/conversations/{conv_id}", headers=owner_headers)
    assert mine.status_code == 200
    assert mine.json()["title"] == "Owner's chat"


def test_memory_is_isolated_between_users(client, make_user):
    owner, owner_headers = make_user()
    other, other_headers = make_user()

    created = client.post("/api/memory", json={"content": "owner's secret preference"}, headers=owner_headers)
    assert created.status_code == 201
    mem_id = created.json()["id"]

    assert mem_id not in [m["id"] for m in client.get("/api/memory", headers=other_headers).json()]
    assert client.put(f"/api/memory/{mem_id}", json={"content": "hijacked"}, headers=other_headers).status_code == 404
    assert client.delete(f"/api/memory/{mem_id}", headers=other_headers).status_code == 404

    still_mine = client.get("/api/memory", headers=owner_headers).json()
    assert any(m["id"] == mem_id and m["content"] == "owner's secret preference" for m in still_mine)


def test_chat_projects_are_isolated_between_users(client, make_user):
    owner, owner_headers = make_user()
    other, other_headers = make_user()

    created = client.post("/api/projects", json={"name": "Owner's project"}, headers=owner_headers)
    assert created.status_code == 200
    project_id = created.json()["id"]

    assert client.get(f"/api/projects/{project_id}", headers=other_headers).status_code == 404
    assert client.patch(f"/api/projects/{project_id}", json={"name": "hijacked"}, headers=other_headers).status_code == 404
    assert client.delete(f"/api/projects/{project_id}", headers=other_headers).status_code == 404
    assert client.post(f"/api/projects/{project_id}/archive", headers=other_headers).status_code == 404

    assert project_id not in [p["id"] for p in client.get("/api/projects", headers=other_headers).json()["items"]]
    mine = client.get(f"/api/projects/{project_id}", headers=owner_headers)
    assert mine.status_code == 200 and mine.json()["name"] == "Owner's project"


def test_scheduled_tasks_are_isolated_between_users(client, make_user):
    owner, owner_headers = make_user()
    other, other_headers = make_user()

    created = client.post(
        "/api/scheduled-tasks",
        json={"title": "Owner's task", "prompt": "do a thing", "schedule": "0 9 * * *"},
        headers=owner_headers,
    )
    assert created.status_code == 200
    task_id = created.json()["id"]

    assert client.patch(f"/api/scheduled-tasks/{task_id}", json={"title": "hijacked"}, headers=other_headers).status_code == 404
    assert client.delete(f"/api/scheduled-tasks/{task_id}", headers=other_headers).status_code == 404
    assert client.post(f"/api/scheduled-tasks/{task_id}/pause", headers=other_headers).status_code == 404
    assert client.post(f"/api/scheduled-tasks/{task_id}/run-now", headers=other_headers).status_code == 404

    task_ids = [t["id"] for t in client.get("/api/scheduled-tasks", headers=other_headers).json()["items"]]
    assert task_id not in task_ids


def test_api_keys_are_isolated_between_users(client, make_user):
    owner, owner_headers = make_user(tier="pro")
    other, other_headers = make_user(tier="pro")

    created = client.post("/api/account/api-keys", json={"name": "owner key"}, headers=owner_headers)
    assert created.status_code == 200
    key_id = created.json()["id"]

    # Not listed for the other user, and not revocable by them either.
    assert key_id not in [k["id"] for k in client.get("/api/account/api-keys", headers=other_headers).json()["items"]]
    assert client.delete(f"/api/account/api-keys/{key_id}", headers=other_headers).status_code == 404

    # Still live for its real owner.
    mine = [k["id"] for k in client.get("/api/account/api-keys", headers=owner_headers).json()["items"]]
    assert key_id in mine


def test_api_key_authenticates_as_its_own_owner_not_someone_else(client, make_user):
    """An API key is a session credential -- using it must resolve to the
    account that created it, never to another user's data."""
    owner, owner_headers = make_user(tier="pro")
    other, _ = make_user()

    created = client.post("/api/account/api-keys", json={"name": "owner key"}, headers=owner_headers)
    assert created.status_code == 200
    plaintext_key = created.json()["key"]

    conv = client.post("/api/conversations", json={"title": "owner-only"}, headers=owner_headers)
    conv_id = conv.json()["id"]

    key_headers = {"Authorization": f"Bearer {plaintext_key}"}
    me = client.get("/auth/me", headers=key_headers)
    assert me.status_code == 200
    assert me.json()["email"] == owner.email
    assert me.json()["email"] != other.email

    # The key can see the owner's own conversation, not fetch as anyone else.
    assert client.get(f"/api/conversations/{conv_id}", headers=key_headers).status_code == 200
