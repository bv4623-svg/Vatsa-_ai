"""Direct coverage for app/services/exchange_rate.py: the fallback chain
(frankfurter -> open.er-api -> fixed constant), the cache-first short
circuit, and the rounding rule the pricing page and checkout both rely on.

The autouse _deterministic_exchange_rate fixture (conftest.py) patches
get_usd_to_inr_rate itself for every other test in the suite, so these
tests explicitly restore the real function and instead patch the lower-
level pieces it calls (_fetch_frankfurter, _fetch_open_er_api, and the
cache) -- that's what actually exercises the logic this module exists for.
"""
import app.services.exchange_rate as exchange_rate

# Captured at collection time, before the autouse _deterministic_exchange_rate
# fixture (conftest.py) has patched the module attribute of the same name.
_REAL_GET_RATE = exchange_rate.get_usd_to_inr_rate


class _FakeCache:
    """Minimal in-memory stand-in for app.utils.cache's cache_get/cache_set,
    scoped to one test via a fresh instance -- avoids depending on whatever
    real cache backend (Redis or in-process) happens to be configured."""

    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ttl_seconds):
        self.store[key] = value


def _use_real_get_rate(monkeypatch):
    """Undoes the autouse fixture's patch for this test only."""
    monkeypatch.setattr(exchange_rate, "get_usd_to_inr_rate", _REAL_GET_RATE)


def _patch_cache(monkeypatch):
    fake = _FakeCache()
    monkeypatch.setattr(exchange_rate, "cache_get", fake.get)
    monkeypatch.setattr(exchange_rate, "cache_set", fake.set)
    return fake


def test_round_to_nearest_10():
    assert exchange_rate.round_to_nearest_10(1992) == 1990
    assert exchange_rate.round_to_nearest_10(8217) == 8220
    assert exchange_rate.round_to_nearest_10(2000) == 2000
    assert exchange_rate.round_to_nearest_10(5) == 0  # exact .5 boundary: Python's round() is round-half-to-even


def test_uses_frankfurter_when_it_succeeds(monkeypatch):
    _use_real_get_rate(monkeypatch)
    _patch_cache(monkeypatch)
    monkeypatch.setattr(exchange_rate, "_fetch_frankfurter", lambda: 90.5)
    monkeypatch.setattr(exchange_rate, "_fetch_open_er_api", lambda: (_ for _ in ()).throw(AssertionError("should not be called")))

    rate, source = exchange_rate.get_usd_to_inr_rate()
    assert (rate, source) == (90.5, "live")


def test_falls_back_to_open_er_api_when_frankfurter_fails(monkeypatch):
    _use_real_get_rate(monkeypatch)
    _patch_cache(monkeypatch)
    monkeypatch.setattr(exchange_rate, "_fetch_frankfurter", lambda: None)
    monkeypatch.setattr(exchange_rate, "_fetch_open_er_api", lambda: 91.2)

    rate, source = exchange_rate.get_usd_to_inr_rate()
    assert (rate, source) == (91.2, "live")


def test_falls_back_to_fixed_rate_when_both_providers_fail(monkeypatch):
    _use_real_get_rate(monkeypatch)
    _patch_cache(monkeypatch)
    monkeypatch.setattr(exchange_rate, "_fetch_frankfurter", lambda: None)
    monkeypatch.setattr(exchange_rate, "_fetch_open_er_api", lambda: None)

    rate, source = exchange_rate.get_usd_to_inr_rate()
    assert (rate, source) == (exchange_rate._FALLBACK_RATE, "fallback")


def test_second_call_is_served_from_cache_without_refetching(monkeypatch):
    _use_real_get_rate(monkeypatch)
    _patch_cache(monkeypatch)
    calls = []
    monkeypatch.setattr(exchange_rate, "_fetch_frankfurter", lambda: calls.append(1) or 87.0)

    first = exchange_rate.get_usd_to_inr_rate()
    second = exchange_rate.get_usd_to_inr_rate()

    assert first == second == (87.0, "live")
    assert len(calls) == 1


def test_get_live_prices_inr_rounds_to_nearest_ten(monkeypatch):
    _use_real_get_rate(monkeypatch)
    _patch_cache(monkeypatch)
    monkeypatch.setattr(exchange_rate, "_fetch_frankfurter", lambda: 83.0)

    prices, rate, source = exchange_rate.get_live_prices_inr()
    assert (rate, source) == (83.0, "live")
    assert prices == {"pro": 1990, "business": 8220}
