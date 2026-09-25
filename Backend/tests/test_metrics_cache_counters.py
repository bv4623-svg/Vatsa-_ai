"""GET /metrics exposes cache_hit_total/cache_miss_total (see app/main.py
and app/utils/cache.py)."""
import app.utils.cache as cache


def test_metrics_exposes_cache_counters(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()
    client.get("/auth/me", headers=headers)
    client.get("/auth/me", headers=headers)  # second call should be a hit

    body = client.get("/metrics").text
    assert "cache_hit_total " in body
    assert "cache_miss_total " in body
