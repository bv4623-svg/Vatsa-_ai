"""get_context_summary is cached per user; every write method invalidates
it. See app/services/memory_service.py."""
import app.utils.cache as cache
from app.services.memory_service import MemoryService


def test_context_summary_is_served_from_cache_on_second_call(db, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, _ = make_user()
    MemoryService.create_memory(db, user.id, "likes dark mode")

    first = MemoryService.get_context_summary(db, user.id)
    assert "dark mode" in first

    # Mutate the DB directly, bypassing MemoryService, so the only way the
    # second call could reflect it is if caching were somehow NOT serving
    # the cached value -- it must still return the pre-mutation summary.
    from app.models.memory import Memory
    db.query(Memory).filter_by(user_id=user.id).delete()
    db.commit()

    second = MemoryService.get_context_summary(db, user.id)
    assert second == first


def test_create_memory_invalidates_the_cache(db, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, _ = make_user()
    MemoryService.get_context_summary(db, user.id)  # populate cache with ""

    MemoryService.create_memory(db, user.id, "prefers concise answers")
    updated = MemoryService.get_context_summary(db, user.id)
    assert "concise answers" in updated


def test_delete_memory_invalidates_the_cache(db, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, _ = make_user()
    mem = MemoryService.create_memory(db, user.id, "lives in Mumbai")
    MemoryService.get_context_summary(db, user.id)  # populate cache

    MemoryService.delete_memory(db, user.id, mem.id)
    assert "Mumbai" not in MemoryService.get_context_summary(db, user.id)


def test_upsert_memory_invalidates_the_cache(db, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, _ = make_user()
    MemoryService.upsert_memory(db, user.id, "identity", "name", "name: Alex")
    first = MemoryService.get_context_summary(db, user.id)
    assert "Alex" in first

    MemoryService.upsert_memory(db, user.id, "identity", "name", "name: Sam")
    second = MemoryService.get_context_summary(db, user.id)
    assert "Sam" in second
    assert "Alex" not in second
