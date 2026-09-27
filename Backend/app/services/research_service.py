"""
Deep research: plan -> search in parallel -> synthesize a cited report.

1. Plan: the model breaks the question into a few focused web queries
   (falls back to the question itself if the model's plan is unusable).
2. Search: every query runs through SearchService concurrently; results are
   merged, de-duplicated by URL and renumbered as one source list.
3. Synthesize: the model streams a structured report that cites the
   numbered sources inline.

Same identity and provider-neutrality rules as chat: no provider, model or
search-backend name ever reaches the client.
"""
import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import urlparse

from app.services.ai_service import (
    AIService, FREE_FALLBACK_MODELS, GENERIC_AI_ERROR, IDENTITY_SEAL,
)
from app.services.search_service import SearchService, build_search_query

logger = logging.getLogger("ResearchService")

MIN_QUERIES = 2
MAX_QUERIES = 5
RESULTS_PER_QUERY = 6
MAX_SOURCES = 15
SEARCH_TIMEOUT_SECONDS = 25
PLAN_MAX_TOKENS = 300
REPORT_MAX_TOKENS = 3500
# Upper bound used for the token-allowance pre-check.
ESTIMATED_TOKENS = 6000

RESEARCH_MODEL_KEY = "auto"

_PLAN_PROMPT = (
    "You plan web research. Break the user's question into {min_q}-{max_q} short, "
    "distinct web search queries that together cover it (facts, recent developments, "
    "different viewpoints). Respond with ONLY a JSON array of strings, no commentary."
)

_REPORT_INSTRUCTIONS = """You are writing a deep-research report for the user's question using ONLY the numbered sources below.

Structure (markdown):
## Summary
2-4 sentences that directly answer the question.
## Key findings
Bullet points, each ending with its citations like [1][3].
## Details
The fuller explanation, organised under short sub-headings, citing as you go.
## Open questions and disagreements
Where sources conflict, are thin, or may be out of date. Say so plainly.

Rules:
- Cite every factual claim with the source numbers that support it.
- Never invent facts, numbers, quotes or sources. If the sources don't cover something, say so.
- Do not list the sources at the end; the app shows them."""


def _candidate_models() -> List[str]:
    target = AIService.map_model(RESEARCH_MODEL_KEY)
    return [target] + [m for m in FREE_FALLBACK_MODELS if m != target]


def parse_plan(raw: str, question: str) -> List[str]:
    """Extracts the query list from the planner's reply. Tolerates code
    fences and surrounding prose; drops blanks/duplicates; always returns
    at least the question itself."""
    queries: List[str] = []
    text = (raw or "").strip()
    match = re.search(r"\[.*\]", text, re.S)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                queries = [str(q) for q in data if isinstance(q, (str, int, float))]
        except json.JSONDecodeError:
            queries = []
    if not queries:
        # A numbered/bulleted list is the most common non-JSON answer; only
        # actual list items count, so stray prose or broken JSON is ignored.
        item = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.+)$")
        queries = [m.group(1).strip(' "') for m in map(item.match, text.splitlines()) if m]
        queries = [q for q in queries if 3 <= len(q) <= 200]

    base = build_search_query(question)
    out: List[str] = []
    seen = set()
    for q in [*queries, base]:
        q = " ".join(q.split())[:200]
        key = q.lower()
        if q and key not in seen:
            seen.add(key)
            out.append(q)
        if len(out) >= MAX_QUERIES:
            break
    return out or [base]


async def plan_queries(question: str) -> List[str]:
    messages = [
        {"role": "system", "content": _PLAN_PROMPT.format(min_q=MIN_QUERIES, max_q=MAX_QUERIES)},
        {"role": "user", "content": build_search_query(question)},
    ]
    for model in _candidate_models():
        try:
            result = await AIService.call_openrouter(messages, model, max_tokens=PLAN_MAX_TOKENS, temperature=0.2)
            return parse_plan(result.get("content", ""), question)
        except Exception as e:
            logger.warning(f"Research planner model {model} failed: {type(e).__name__}: {e}")
    # Planning is an optimisation; research still works from the question alone.
    return parse_plan("", question)


def merge_sources(batches: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Interleaves per-query results (so every query contributes its best
    hits before any query's weaker ones), de-duplicates by URL, caps the
    total, and renumbers 1..N."""
    merged: List[Dict[str, Any]] = []
    seen = set()
    longest = max((len(b) for b in batches), default=0)
    for rank in range(longest):
        for batch in batches:
            if rank >= len(batch):
                continue
            r = batch[rank]
            url = r.get("url") or ""
            parsed = urlparse(url)
            key = (parsed.netloc.replace("www.", "") + parsed.path.rstrip("/")).lower()
            if not url or key in seen:
                continue
            seen.add(key)
            merged.append(dict(r))
            if len(merged) >= MAX_SOURCES:
                break
        if len(merged) >= MAX_SOURCES:
            break
    for i, r in enumerate(merged, 1):
        r["index"] = i
    return merged


async def _search_one(query: str) -> List[Dict[str, Any]]:
    try:
        return await asyncio.wait_for(SearchService.search(query, RESULTS_PER_QUERY), SEARCH_TIMEOUT_SECONDS)
    except Exception as e:
        logger.warning(f"Research search failed for {query!r}: {type(e).__name__}: {e}")
        return []


async def gather_sources(queries: List[str]) -> List[Dict[str, Any]]:
    batches = await asyncio.gather(*(_search_one(q) for q in queries))
    return merge_sources(list(batches))


def build_report_messages(question: str, sources: List[Dict[str, Any]], user_name: Optional[str] = None) -> List[Dict[str, str]]:
    context = SearchService.format_context(sources, build_search_query(question))
    system = "\n\n".join(filter(None, [
        "You are Vatsa AI, a meticulous research assistant.",
        f"The user's name is {user_name}." if user_name else None,
        _REPORT_INSTRUCTIONS,
        context,
        IDENTITY_SEAL,
    ]))
    return [{"role": "system", "content": system}, {"role": "user", "content": question}]


async def run_research(question: str, user_name: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
    """Yields, in order:
      {"stage": "planning"}
      {"stage": "searching", "queries": [...]}
      {"stage": "writing", "source_count": n}
      {"delta": str} ...
      {"done": True, "content": str, "queries": [...], "sources": [...], "usage": {...}}
    or a terminal {"error": str, "code": str, "retryable": bool}."""
    yield {"stage": "planning"}
    queries = await plan_queries(question)

    yield {"stage": "searching", "queries": queries}
    sources = await gather_sources(queries)
    if not sources:
        yield {
            "error": "Couldn't find any sources for this question. Try rephrasing it or making it more specific.",
            "code": "no_sources",
            "retryable": True,
        }
        return

    yield {"stage": "writing", "source_count": len(sources)}
    messages = build_report_messages(question, sources, user_name)

    text = ""
    usage: Dict[str, Any] = {}
    started = False
    last_error: Optional[Exception] = None
    for model in _candidate_models():
        try:
            async for event in AIService.stream_openrouter(messages, model, max_tokens=REPORT_MAX_TOKENS, temperature=0.3):
                if event["type"] == "delta":
                    started = True
                    text += event["content"]
                    yield {"delta": event["content"]}
                elif event["type"] == "usage":
                    usage = event["usage"]
            break
        except Exception as e:
            last_error = e
            logger.warning(f"Research writer model {model} failed: {type(e).__name__}: {e}")
            if started:
                # Partial report already streamed; switching models would
                # splice two different reports together.
                break

    if not text:
        logger.error(f"Research synthesis failed: {last_error}")
        yield {"error": GENERIC_AI_ERROR, "code": "ai_unavailable", "retryable": True}
        return

    prompt_tokens = usage.get("prompt_tokens") or sum(len(m["content"]) for m in messages) // 4
    completion_tokens = usage.get("completion_tokens") or len(text) // 4
    yield {
        "done": True,
        "content": text,
        "queries": queries,
        "sources": sources,
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }
