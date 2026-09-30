"""GET /api/projects is cached per (user, archived-filter); every write on
a project invalidates it. See app/routers/chat_projects/crud.py."""
import app.utils.cache as cache


def test_list_is_served_from_cache_after_first_call(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, headers = make_user()

    created = client.post("/api/projects", json={"name": "Alpha"}, headers=headers)
    assert created.status_code == 200, created.text

    first = client.get("/api/projects", headers=headers).json()
    assert len(first["items"]) == 1

    # A second project created through a path that does NOT invalidate
    # (simulated here by writing straight to the DB) must not appear while
    # the cache is still warm -- proves the second GET actually hit cache.
    from app.database import SessionLocal
    from app.models.chat_project import ChatProject
    import uuid
    db = SessionLocal()
    try:
        db.add(ChatProject(id=uuid.uuid4().hex, user_id=user.id, name="Sneaky"))
        db.commit()
    finally:
        db.close()

    second = client.get("/api/projects", headers=headers).json()
    assert len(second["items"]) == 1


def test_create_project_invalidates_the_list_cache(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()

    client.get("/api/projects", headers=headers)  # populate cache with 0 items
    client.post("/api/projects", json={"name": "Beta"}, headers=headers)

    listed = client.get("/api/projects", headers=headers).json()
    assert len(listed["items"]) == 1
    assert listed["items"][0]["name"] == "Beta"


def test_delete_project_invalidates_the_list_cache(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()

    created = client.post("/api/projects", json={"name": "Gamma"}, headers=headers).json()
    client.get("/api/projects", headers=headers)  # populate cache with 1 item

    client.delete(f"/api/projects/{created['id']}", headers=headers)
    listed = client.get("/api/projects", headers=headers).json()
    assert listed["items"] == []


def test_archive_invalidates_both_filtered_cache_variants(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()

    created = client.post("/api/projects", json={"name": "Delta"}, headers=headers).json()
    client.get("/api/projects?archived=false", headers=headers)  # populate cache
    client.get("/api/projects?archived=true", headers=headers)   # populate cache (empty)

    client.post(f"/api/projects/{created['id']}/archive", headers=headers)

    assert client.get("/api/projects?archived=false", headers=headers).json()["items"] == []
    archived_items = client.get("/api/projects?archived=true", headers=headers).json()["items"]
    assert len(archived_items) == 1
