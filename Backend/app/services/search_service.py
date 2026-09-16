"""
Multi-source web search grounding for chat. Runs every configured
provider (Tavily, Serper, Brave -- each only if its key is set) plus
Wikipedia (no key needed, used for factual-style queries) in parallel,
then dedupes and ranks the combined results before handing the top N
to the model as citable context.

Provider identity is never exposed past this module -- the model-
identity seal's "never name a backing service" policy applies here
too, same as it does for the AI model and the image generator.
"""
import os
import re
import json
import asyncio
import logging
from typing import List, Dict, Any
from urllib.parse import urlparse
import aiohttp

logger = logging.getLogger("SearchService")

_FACTUAL_TRIGGERS = [
    "who is", "who was", "what is", "what was", "when did", "when was",
    "where is", "where was", "president of", "prime minister of",
    "capital of", "population of", "history of", "founder of",
    "invented", "discovered", "born", "died",
]

_AUTHORITY_DOMAINS = [
    "wikipedia.org", ".gov", ".edu", "reuters.com", "apnews.com",
    "bbc.com", "nytimes.com", "thehindu.com", "indianexpress.com",
]

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")

# Wikipedia's API rejects requests with no identifying User-Agent (403,
# per their robot policy) -- aiohttp sends no meaningful default.
_WIKIPEDIA_HEADERS = {"User-Agent": "VatsaAI/1.0 (https://vatsa-ai.local)"}


def _strip_html(text: str) -> str:
    return _HTML_TAG_RE.sub("", text or "")


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _normalize_title(title: str) -> str:
    return _NON_ALNUM_RE.sub("", title.lower())[:60]


def _is_factual_query(query: str) -> bool:
    q = query.lower()
    return any(t in q for t in _FACTUAL_TRIGGERS)


class SearchService:
    @staticmethod
    def is_configured() -> bool:
        # Wikipedia needs no key, so a factual query always has somewhere
        # to search -- but real breadth needs at least one paid provider.
        return True

    @staticmethod
    async def _tavily(session: aiohttp.ClientSession, query: str, n: int) -> List[Dict[str, Any]]:
        key = os.getenv("TAVILY_API_KEY")
        if not key:
            return []
        try:
            async with session.post(
                "https://api.tavily.com/search",
                json={"api_key": key, "query": query, "max_results": n, "search_depth": "advanced"},
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                return [
                    {
                        "title": r.get("title") or "",
                        "url": r.get("url") or "",
                        "snippet": _strip_html(r.get("content", ""))[:500],
                        "provider": "tavily",
                        "published_date": r.get("published_date"),
                    }
                    for r in data.get("results", [])
                ]
        except Exception as e:
            logger.warning(f"Tavily search failed: {e}")
            return []

    @staticmethod
    async def _serper(session: aiohttp.ClientSession, query: str, n: int) -> List[Dict[str, Any]]:
        key = os.getenv("SERPER_API_KEY")
        if not key:
            return []
        try:
            async with session.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": key, "Content-Type": "application/json"},
                json={"q": query, "num": n},
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                return [
                    {
                        "title": r.get("title") or "",
                        "url": r.get("link") or "",
                        "snippet": _strip_html(r.get("snippet", ""))[:500],
                        "provider": "serper",
                        "published_date": r.get("date"),
                    }
                    for r in data.get("organic", [])
                ]
        except Exception as e:
            logger.warning(f"Serper search failed: {e}")
            return []

    @staticmethod
    async def _brave(session: aiohttp.ClientSession, query: str, n: int) -> List[Dict[str, Any]]:
        key = os.getenv("BRAVE_API_KEY")
        if not key:
            return []
        try:
            async with session.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": key, "Accept": "application/json"},
                params={"q": query, "count": n},
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                return [
                    {
                        "title": r.get("title") or "",
                        "url": r.get("url") or "",
                        "snippet": _strip_html(r.get("description", ""))[:500],
                        "provider": "brave",
                        "published_date": r.get("age"),
                    }
                    for r in (data.get("web") or {}).get("results", [])
                ]
        except Exception as e:
            logger.warning(f"Brave search failed: {e}")
            return []

    @staticmethod
    async def _wikipedia_extract(session: aiohttp.ClientSession, title: str) -> str:
        """
        MediaWiki's search snippet is a ~150-char teaser that often
        doesn't contain the actual fact being asked about (e.g. "who is
        the current president" needs the intro paragraph, not just the
        opening clause). Fetches the plain-text intro for one page.
        """
        try:
            async with session.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query", "prop": "extracts", "exintro": "true",
                    "explaintext": "true", "titles": title, "format": "json",
                },
                headers=_WIKIPEDIA_HEADERS,
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return ""
                data = json.loads(await resp.text())
                pages = data.get("query", {}).get("pages", {})
                for page in pages.values():
                    extract = page.get("extract", "")
                    if extract:
                        return extract[:600]
        except Exception as e:
            logger.warning(f"Wikipedia extract fetch failed for '{title}': {e}")
        return ""

    @staticmethod
    async def _wikipedia(session: aiohttp.ClientSession, query: str, n: int = 3) -> List[Dict[str, Any]]:
        try:
            async with session.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "query", "list": "search", "srsearch": query, "format": "json", "srlimit": n},
                headers=_WIKIPEDIA_HEADERS,
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                hits = data.get("query", {}).get("search", [])

                results = []
                for r in hits:
                    title = r["title"]
                    results.append({
                        "title": f"{title} - Wikipedia",
                        "url": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                        "snippet": _strip_html(r.get("snippet", ""))[:500],
                        "provider": "wikipedia",
                        "published_date": r.get("timestamp"),
                    })

                # Only the top hit gets the extra round-trip -- it's the
                # one most likely to actually answer the question, and
                # the ranking step will keep it near the top anyway.
                if results:
                    extract = await SearchService._wikipedia_extract(session, hits[0]["title"])
                    if extract:
                        results[0]["snippet"] = extract

                return results
        except Exception as e:
            logger.warning(f"Wikipedia search failed: {e}")
            return []

    @staticmethod
    def _rank_score(r: Dict[str, Any]) -> float:
        score = 0.0
        domain = _domain(r["url"])
        if any(d in domain for d in _AUTHORITY_DOMAINS):
            score += 10
        score += min(len(r.get("snippet", "")), 300) / 30
        if r.get("provider") == "wikipedia":
            score += 5
        # Providers return results already sorted by their own relevance;
        # rewarding an earlier native position keeps that ordering intact
        # among otherwise similarly-scored results instead of scrambling it.
        score -= r.get("native_rank", 0) * 0.5
        return score

    @staticmethod
    def _quality(url: str) -> str:
        domain = _domain(url)
        if any(d in domain for d in _AUTHORITY_DOMAINS):
            return "high"
        return "medium" if domain else "low"

    @staticmethod
    async def search(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Searches every configured provider in parallel plus Wikipedia
        (for factual-looking queries), dedupes by URL/title, ranks by
        authority + snippet richness, and returns the top `max_results`
        with citation-ready metadata (index, domain, quality, favicon).
        Raises RuntimeError if nothing came back at all.
        """
        async with aiohttp.ClientSession() as session:
            tasks = [
                SearchService._tavily(session, query, max_results),
                SearchService._serper(session, query, max_results),
                SearchService._brave(session, query, max_results),
            ]
            if _is_factual_query(query):
                tasks.append(SearchService._wikipedia(session, query))
            batches = await asyncio.gather(*tasks, return_exceptions=True)

        results: List[Dict[str, Any]] = []
        for batch in batches:
            if isinstance(batch, list):
                # Providers already rank their own results by relevance --
                # preserve that as a tiebreaker so same-domain hits don't
                # get reordered arbitrarily by our own scoring alone.
                for native_rank, r in enumerate(batch):
                    r["native_rank"] = native_rank
                    results.append(r)

        if not results:
            raise RuntimeError("No search results available (no provider configured, or all failed).")

        seen_urls, seen_titles, deduped = set(), set(), []
        for r in results:
            if not r.get("url") or not r.get("title"):
                continue
            url_key = _domain(r["url"]) + urlparse(r["url"]).path.rstrip("/")
            title_key = _normalize_title(r["title"])
            if url_key in seen_urls or title_key in seen_titles:
                continue
            seen_urls.add(url_key)
            seen_titles.add(title_key)
            deduped.append(r)

        deduped.sort(key=SearchService._rank_score, reverse=True)
        top = deduped[:max_results]

        for i, r in enumerate(top, 1):
            r["index"] = i
            r["domain"] = _domain(r["url"])
            r["quality"] = SearchService._quality(r["url"])
            r["favicon"] = f"https://www.google.com/s2/favicons?domain={r['domain']}&sz=32"
            r.pop("provider", None)  # never expose which backend served this
            r.pop("native_rank", None)  # internal ranking signal only

        return top

    @staticmethod
    def format_context(results: List[Dict[str, Any]]) -> str:
        if not results:
            return ""
        lines = ["=== LIVE WEB SEARCH RESULTS ==="]
        for r in results:
            date = f" ({r['published_date']})" if r.get("published_date") else ""
            lines.append(f"\n[{r['index']}] {r['title']}{date}")
            lines.append(f"URL: {r['url']}")
            lines.append(r.get("snippet", ""))
        lines.append(
            "\nINSTRUCTIONS:\n"
            "- Answer using ONLY the sources above.\n"
            "- Cite sources inline as [1], [2], etc. Cite every source that supports a claim: [1][2].\n"
            "- If sources disagree, say so explicitly rather than silently picking one.\n"
            "- If the sources don't answer the question, say you couldn't find reliable sources -- never invent facts.\n"
        )
        return "\n".join(lines)
