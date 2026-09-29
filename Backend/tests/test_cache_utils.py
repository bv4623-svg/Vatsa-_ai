"""Unit tests for the cache abstraction itself (app/utils/cache.py),
independent of any route that uses it.

Patches app.utils.cache.CACHE_ENABLED in place (module attribute lookup
happens at call time inside cache_get/cache_set, not at import time) rather
than reloading the module -- a reload would create a second, disconnected
copy of _backend/_local_fallback/counters that no other already-imported
module (which did `from app.utils.cache import cache_get`) would ever see.
"""
import time

import app.utils.cache as cache


def test_disabled_cache_is_always_a_miss(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", False)
    cache.cache_set("k-disabled", {"a": 1})
    assert cache.cache_get("k-disabled") is None


def test_set_then_get_round_trips_json(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    cache.cache_set("profile:test-1", {"name": "Bighnesh", "tier": "free"})
    assert cache.cache_get("profile:test-1") == {"name": "Bighnesh", "tier": "free"}


def test_delete_removes_the_entry(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    cache.cache_set("k-delete", {"v": 1})
    cache.cache_delete("k-delete")
    assert cache.cache_get("k-delete") is None


def test_ttl_expiry(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    cache.cache_set("k-ttl", {"v": 1}, ttl_seconds=0)
    time.sleep(0.01)
    assert cache.cache_get("k-ttl") is None


def test_hit_and_miss_counters(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    hits_before, misses_before = cache.counters.snapshot()
    cache.cache_get("never-set-key")
    cache.cache_set("k-counted", {"v": 1})
    cache.cache_get("k-counted")
    hits_after, misses_after = cache.counters.snapshot()
    assert misses_after == misses_before + 1
    assert hits_after == hits_before + 1


def test_cache_delete_many(monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    cache.cache_set("k-multi-1", {"v": 1})
    cache.cache_set("k-multi-2", {"v": 2})
    cache.cache_delete_many(["k-multi-1", "k-multi-2"])
    assert cache.cache_get("k-multi-1") is None
    assert cache.cache_get("k-multi-2") is None


def test_cache_enabled_defaults_to_false_outside_production():
    """This module was already imported (by app.main, at test-session
    start) with whatever ENV/CACHE_ENABLED the real environment had; the
    real .env in this repo does not set ENV, so it must have come up off."""
    assert cache.CACHE_ENABLED is False
