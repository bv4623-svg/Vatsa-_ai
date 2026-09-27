"""Rate limiter: client IP can't be spoofed via X-Forwarded-For, and expired
buckets don't accumulate in memory."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.utils import rate_limit


def _req(xff=None, host="10.0.0.9"):
    headers = {"x-forwarded-for": xff} if xff is not None else {}
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=host))


def test_spoofed_forwarded_for_does_not_change_the_client_ip(monkeypatch):
    """Behind one proxy, the proxy APPENDS the real client address; anything
    to its left came from the client and can be forged."""
    monkeypatch.setenv("TRUSTED_PROXY_COUNT", "1")
    real = "203.0.113.7"
    assert rate_limit.client_ip(_req(f"{real}")) == real
    assert rate_limit.client_ip(_req(f"1.1.1.1, {real}")) == real
    assert rate_limit.client_ip(_req(f"9.9.9.9, 8.8.8.8, {real}")) == real


def test_without_a_proxy_the_header_is_ignored(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_COUNT", "0")
    assert rate_limit.client_ip(_req("1.1.1.1", host="198.51.100.4")) == "198.51.100.4"


def test_two_proxies(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_COUNT", "2")
    assert rate_limit.client_ip(_req("6.6.6.6, 203.0.113.7, 10.1.1.1")) == "203.0.113.7"


def test_header_shorter_than_proxy_chain_falls_back_to_socket(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_COUNT", "2")
    assert rate_limit.client_ip(_req("203.0.113.7", host="10.0.0.1")) == "10.0.0.1"


def test_login_ip_limit_holds_against_rotating_fake_ips(client, make_user, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_COUNT", "1")
    rate_limit._buckets.clear()
    user, _ = make_user()
    codes = []
    for i in range(12):
        res = client.post(
            "/auth/login",
            json={"email": f"nobody{i}@example.com", "password": "wrong-password-1"},
            headers={"X-Forwarded-For": f"10.9.{i}.1, 203.0.113.50"},
        )
        codes.append(res.status_code)
    assert 429 in codes, f"IP limit bypassed by rotating spoofed X-Forwarded-For: {codes}"


def test_expired_buckets_are_pruned(monkeypatch):
    rate_limit._buckets.clear()
    now = [1_000_000.0]
    monkeypatch.setattr(rate_limit.time, "time", lambda: now[0])
    for i in range(5000):
        rate_limit.enforce_rate_limit(f"k{i}", limit=5, window_seconds=60)
    assert len(rate_limit._buckets) == 5000
    now[0] += 61  # every window has expired
    for _ in range(rate_limit.PRUNE_EVERY):
        rate_limit.enforce_rate_limit("fresh", limit=10_000, window_seconds=60)
    assert len(rate_limit._buckets) == 1, "expired buckets must be dropped"


def test_limit_still_enforced(monkeypatch):
    rate_limit._buckets.clear()
    for _ in range(3):
        rate_limit.enforce_rate_limit("x", limit=3, window_seconds=60)
    with pytest.raises(HTTPException) as e:
        rate_limit.enforce_rate_limit("x", limit=3, window_seconds=60)
    assert e.value.status_code == 429
