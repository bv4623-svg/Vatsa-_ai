"""Web search relevance floor: a result sharing zero tokens with the query
can't reach the model as "context" just by scoring well on domain
authority/snippet length/recency alone. See SearchService._relevant and
MIN_RELEVANT_OVERLAP in app/services/search_service.py -- this is the
fix for the class of bug where a completely unrelated result (a scraper
hiccup, a provider returning a cached/trending page) still gets ranked
and handed to the model as if it answered the question."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.services.search_service import SearchService, _tokenize
from tests.test_chat_and_vision_integration import fake_router  # noqa: F401 -- reused fixture


def _result(title, snippet="", url="https://example.com/page", **kw):
    return {"title": title, "snippet": snippet, "url": url, **kw}


def test_zero_overlap_result_is_not_relevant():
    query_tokens = set(_tokenize("Explain quantum computing in simple Hindi"))
    unrelated = _result("Best Summer Vacation Spots 2026", "Top beaches and mountains to visit this summer.")
    assert SearchService._relevant(query_tokens, unrelated) is False


def test_on_topic_result_is_relevant_even_with_non_ascii_content():
    """The real symptom this fixes involved a Hindi-language query --
    tokenization strips non-ASCII script, so relevance has to come from
    the English terms that still appear in mixed-language content."""
    query_tokens = set(_tokenize("Explain quantum computing in simple Hindi"))
    on_topic = _result("Quantum Computing in Hindi | Notes In Hindi", "क्वांटम कम्प्यूटिंग की पूरी जानकारी")
    assert SearchService._relevant(query_tokens, on_topic) is True


def test_a_zero_overlap_result_cannot_win_on_authority_alone():
    """Before this fix, a long-snippet .gov page about something else
    entirely could still outscore nothing (no floor existed) and end up
    in the top N. Confirms the floor, not just the score, blocks it."""
    query_tokens = set(_tokenize("Explain quantum computing in simple Hindi"))
    authoritative_but_unrelated = _result(
        "Annual Tax Filing Guide",
        "A" * 500,  # maxes out the snippet-length score component
        url="https://irs.gov/filing-guide",
    )
    score = SearchService._rank_score(query_tokens, authoritative_but_unrelated)
    assert score > 0  # it does score decently on non-relevance signals alone
    assert SearchService._relevant(query_tokens, authoritative_but_unrelated) is False


def test_search_raises_when_every_result_is_irrelevant():
    """search() must fail loudly (RuntimeError) rather than silently
    return junk -- app/routers/chat.py's _get_search_context already
    catches this and proceeds without search context, which is exactly
    the "ignore bad search, answer from internal knowledge" behavior."""
    junk = [_result("Best Summer Vacation Spots 2026", "Beaches and mountains.", url=f"https://x.com/{i}") for i in range(3)]
    with patch.object(SearchService, "_duckduckgo", AsyncMock(return_value=junk)):
        with pytest.raises(RuntimeError):
            asyncio.run(SearchService.search("Explain quantum computing in simple Hindi"))


def test_search_filters_out_irrelevant_results_mixed_with_relevant_ones():
    mixed = [
        _result("Best Summer Vacation Spots 2026", "Beaches and mountains.", url="https://x.com/1"),
        _result("Quantum Computing Explained Simply", "An introduction to qubits and superposition.", url="https://x.com/2"),
    ]
    with patch.object(SearchService, "_duckduckgo", AsyncMock(return_value=mixed)):
        results = asyncio.run(SearchService.search("Explain quantum computing"))
    assert len(results) == 1
    assert "Quantum" in results[0]["title"]


def test_chat_falls_back_gracefully_when_search_finds_nothing_relevant(client, make_user, fake_router):
    """End-to-end: a chat request with web_search=true, where search turns
    up nothing relevant, must not error out or apologize about search --
    it should just proceed as if web_search had been off, answering from
    the model directly."""
    junk = [_result("Best Summer Vacation Spots 2026", "Beaches and mountains.", url=f"https://x.com/{i}") for i in range(3)]
    fake_router.reply = "Quantum computing uses qubits instead of classical bits."
    _, headers = make_user(email="search-fallback@example.com")

    with patch.object(SearchService, "_duckduckgo", AsyncMock(return_value=junk)):
        res = client.post(
            "/api/chat",
            headers=headers,
            json={"message": "Explain quantum computing in simple Hindi", "web_search": True, "stream": False},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["response"] == fake_router.reply
    assert "sorry" not in body["response"].lower()
    assert "couldn't find" not in body["response"].lower()
