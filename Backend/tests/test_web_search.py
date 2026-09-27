"""Web search: query building, caching, SSRF guard, ranking, and the chat
integration (quota, notices, provider identity). Providers are always
mocked -- nothing here touches the network."""
import asyncio
import json
from datetime import date

import pytest

from app.services import search_service
from app.services.search_service import SearchService, build_search_query, _is_public_url
from llm_fakes import fake_llm, sse_events as _sse_events  # noqa: F401  (fixture)


def _result(title, url, snippet="A reasonably long snippet about the topic " * 3):
    return {"title": title, "url": url, "snippet": snippet, "provider": "duckduckgo", "published_date": None}


@pytest.fixture(autouse=True)
def _fresh_cache():
    search_service.clear_search_cache()
    yield
    search_service.clear_search_cache()


@pytest.fixture()
def fake_providers(monkeypatch):
    """DDG returns canned results; every other provider returns nothing, as
    it does when unconfigured. Counts calls so caching can be asserted."""
    calls = {"ddg": 0, "fail": False, "results": [
        _result("Tokyo - capital of Japan", "https://en.wikipedia.org/wiki/Tokyo"),
        _result("Japan travel guide", "https://example.com/japan"),
    ]}

    async def _ddg(query, n):
        calls["ddg"] += 1
        if calls["fail"]:
            return []
        return [dict(r) for r in calls["results"]]

    async def _none(*a, **k):
        return []

    async def _no_enrich(session, r):
        return None

    monkeypatch.setattr(SearchService, "_duckduckgo", staticmethod(_ddg))
    for name in ("_google_cse", "_searxng", "_tavily", "_serper", "_brave", "_wikipedia"):
        monkeypatch.setattr(SearchService, name, staticmethod(_none))
    monkeypatch.setattr(SearchService, "_enrich_snippet", staticmethod(_no_enrich))
    return calls


# ---- pure helpers ---------------------------------------------------------

def test_build_search_query_strips_inlined_attachments():
    msg = "summarise this report\n\n--- File: a.pdf ---\n" + "lorem ipsum " * 5000
    assert build_search_query(msg) == "summarise this report"


def test_build_search_query_caps_length_and_whitespace():
    q = build_search_query("  word   " * 500)
    assert len(q) <= search_service.MAX_QUERY_CHARS
    assert "  " not in q


def test_build_search_query_empty():
    assert build_search_query("") == ""
    assert build_search_query("\n\n--- File: x ---\nbody") == ""


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin",
    "http://localhost:8000/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://[::1]/",
    "file:///etc/passwd",
    "gopher://example.com",
    "not a url",
])
def test_ssrf_guard_blocks_internal_targets(url):
    assert asyncio.run(_is_public_url(url)) is False


def test_ssrf_guard_allows_public_ip_literal():
    assert asyncio.run(_is_public_url("https://1.1.1.1/")) is True


def test_format_context_numbers_sources_and_forbids_invention():
    ctx = SearchService.format_context([{"index": 1, "title": "T", "url": "https://x.org", "snippet": "S"}], "q")
    assert "[1] T" in ctx and "URL: https://x.org" in ctx
    assert "never invent facts" in ctx


# ---- service ---------------------------------------------------------------

def test_search_returns_ranked_citation_ready_results(fake_providers):
    results = asyncio.run(SearchService.search("what is the capital of Japan"))
    assert results[0]["url"] == "https://en.wikipedia.org/wiki/Tokyo"
    for i, r in enumerate(results, 1):
        assert r["index"] == i
        assert r["domain"] and r["favicon"].startswith("https://")
        assert "provider" not in r and "native_rank" not in r


def test_search_dedupes_same_url(fake_providers):
    fake_providers["results"] = [
        _result("A", "https://example.com/page"),
        _result("A copy", "https://www.example.com/page/"),
    ]
    assert len(asyncio.run(SearchService.search("example page"))) == 1


def test_search_cache_hits_skip_providers(fake_providers):
    asyncio.run(SearchService.search("rust async runtime"))
    first = fake_providers["ddg"]
    again = asyncio.run(SearchService.search("  Rust   ASYNC runtime "))
    assert fake_providers["ddg"] == first, "second identical query must be served from cache"
    again[0]["title"] = "mutated"
    assert asyncio.run(SearchService.search("rust async runtime"))[0]["title"] != "mutated"


def test_search_raises_when_every_provider_empty(fake_providers):
    fake_providers["fail"] = True
    with pytest.raises(RuntimeError):
        asyncio.run(SearchService.search("anything at all"))


def test_empty_query_rejected():
    with pytest.raises(ValueError):
        asyncio.run(SearchService.search("   "))


# ---- chat integration -------------------------------------------------------

def test_chat_with_search_returns_sources_and_grounds_prompt(client, make_user, fake_llm, fake_providers):
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "capital of Japan", "web_search": True}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["sources"][0]["index"] == 1
    assert "notice" not in body
    system_prompt = fake_llm["messages"][0][0]["content"]
    assert "LIVE WEB SEARCH RESULTS" in system_prompt


def test_chat_stream_with_search_sends_sources_on_done(client, make_user, fake_llm, fake_providers):
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "capital of Japan", "webSearch": True, "stream": True}, headers=headers)
    done = _sse_events(res.text)[-1]
    assert done["done"] and done["sources"]


def test_search_quota_exhausted_sends_notice_and_still_answers(client, make_user, fake_llm, fake_providers, db):
    from app.models.usage_daily import UsageDaily
    user, headers = make_user()
    db.add(UsageDaily(user_id=user.id, feature="web_search", date=date.today(), count=5))
    db.commit()
    res = client.post("/api/chat", json={"message": "news today", "web_search": True, "stream": True}, headers=headers)
    events = _sse_events(res.text)
    assert events[0]["notice"] == search_service_notice_limit()
    assert events[-1]["done"] is True
    assert fake_providers["ddg"] == 0


def search_service_notice_limit():
    from app.routers.chat import SEARCH_NOTICE_LIMIT
    return SEARCH_NOTICE_LIMIT


def test_search_outage_sends_notice(client, make_user, fake_llm, fake_providers):
    fake_providers["fail"] = True
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "news today", "web_search": True}, headers=headers)
    assert res.status_code == 200
    assert "unavailable" in res.json()["notice"]


def test_search_uses_quota_only_on_success(client, make_user, fake_llm, fake_providers, db):
    from app.models.usage_daily import UsageDaily
    fake_providers["fail"] = True
    user, headers = make_user()
    client.post("/api/chat", json={"message": "q", "web_search": True}, headers=headers)
    row = db.query(UsageDaily).filter_by(user_id=user.id, feature="web_search").first()
    assert row is None or row.count == 0


def test_sources_never_name_the_backend(client, make_user, fake_llm, fake_providers):
    _, headers = make_user()
    res = client.post("/api/chat", json={"message": "capital of Japan", "web_search": True}, headers=headers)
    assert "duckduckgo" not in json.dumps(res.json()["sources"]).lower()
