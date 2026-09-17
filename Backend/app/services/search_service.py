"""
Multi-source web search grounding for chat. Runs every available
provider in parallel -- DuckDuckGo always (no key needed), Google CSE
and a self-hosted SearxNG instance if configured, Tavily/Serper/Brave
if their keys are set, plus a Wikipedia direct-lookup for factual-style
queries -- then dedupes and ranks the combined results by how well
they actually answer the query before handing the top N to the model
as citable context.

Provider identity is never exposed past this module -- the model-
identity seal's "never name a backing service" policy applies here
too, same as it does for the AI model and the image generator.
"""
import os
import re
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse, quote
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

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "of", "in", "on", "at", "to", "for", "and", "or", "but", "with",
    "what", "who", "when", "where", "why", "how", "does", "do", "did",
    "this", "that", "these", "those", "it", "its", "as", "by", "from",
}

# Wikipedia's API (and any hand-rolled User-Agent-checking API) rejects
# requests with no identifying header (403, per Wikipedia's robot
# policy) -- aiohttp sends no meaningful default.
_VATSA_UA = {"User-Agent": "VatsaAI/1.0 (https://vatsa-ai.local)"}

_META_DESC_RE = re.compile(
    r'<meta[^>]+(?:property=["\']og:description["\']|name=["\']description["\'])[^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _strip_html(text: str) -> str:
    return _HTML_TAG_RE.sub("", text or "")


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _normalize_title(title: str) -> str:
    return _NON_ALNUM_RE.sub("", title.lower())[:60]


def _tokenize(text: str) -> List[str]:
    words = _NON_ALNUM_RE.sub(" ", text.lower()).split()
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


def _is_factual_query(query: str) -> bool:
    q = query.lower()
    return any(t in q for t in _FACTUAL_TRIGGERS)


def _wikipedia_subject(text: str) -> str:
    """Extracts the core subject from a natural-language question, e.g.
    "What is the capital of Japan?" -> "capital Japan" -- MediaWiki's
    search treats the raw question as a bag of keywords, so leaving the
    question words in lets an unrelated page win on a keyword like
    "capital" matching "Capital punishment in Japan"."""
    q = text.lower().strip().rstrip("?").strip()
    prefixes = [
        "what is the ", "what is ", "what's the ", "what's ",
        "who is the ", "who is ", "who's ",
        "where is the ", "where is ", "where's ",
        "when was ", "when did ", "when is ",
    ]
    for p in prefixes:
        if q.startswith(p):
            q = q[len(p):]
            break
    for suffix in (" of", " in", " at", " for", " to"):
        if q.endswith(suffix):
            q = q[: -len(suffix)]
    return q.strip() or text.strip()


def _expand_query(query: str) -> List[str]:
    """A couple of targeted rephrasings for query shapes that benefit
    from it, run alongside the original -- not a general-purpose NLP
    rewrite, just the handful of patterns that come up constantly in
    factual questions."""
    variations = [query]
    q = query.lower().strip("? ").strip()

    m = re.match(r"what(?:'s| is) the capital of (.+)", q)
    if m:
        country = m.group(1).strip()
        variations.append(f"{country} capital city")

    m = re.match(r"who(?:'s| is) (.+)", q)
    if m:
        variations.append(f"{m.group(1).strip()} biography")

    m = re.match(r"when (?:did|was) (.+)", q)
    if m:
        variations.append(f"{m.group(1).strip()} date")

    return variations[:2]  # original + at most one rephrasing


class SearchService:
    @staticmethod
    def is_configured() -> bool:
        # DuckDuckGo needs no key, so there's always somewhere to search.
        return True

    # ------------------------------------------------------------------
    # Providers
    # ------------------------------------------------------------------

    @staticmethod
    async def _duckduckgo(query: str, n: int) -> List[Dict[str, Any]]:
        """Real web results, no API key -- runs in a thread since the
        underlying library is a synchronous scraper, not an async client."""
        def _sync() -> List[Dict[str, Any]]:
            from ddgs import DDGS
            with DDGS() as ddgs:
                raw = list(ddgs.text(query, max_results=n))
            return [
                {
                    "title": r.get("title") or "",
                    "url": r.get("href") or "",
                    "snippet": _strip_html(r.get("body", ""))[:500],
                    "provider": "duckduckgo",
                    "published_date": None,
                }
                for r in raw
            ]
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _sync)
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {type(e).__name__}: {e}")
            return []

    @staticmethod
    async def _google_cse(session: aiohttp.ClientSession, query: str, n: int) -> List[Dict[str, Any]]:
        api_key = os.getenv("GOOGLE_CSE_API_KEY")
        cx = os.getenv("GOOGLE_CSE_ID")
        if not api_key or not cx:
            return []
        try:
            async with session.get(
                "https://www.googleapis.com/customsearch/v1",
                params={"key": api_key, "cx": cx, "q": query, "num": min(n, 10)},
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                results = []
                for r in data.get("items", []):
                    metatags = (r.get("pagemap", {}) or {}).get("metatags", [{}])
                    published = metatags[0].get("article:published_time") if metatags else None
                    results.append({
                        "title": r.get("title") or "",
                        "url": r.get("link") or "",
                        "snippet": _strip_html(r.get("snippet", ""))[:500],
                        "provider": "google",
                        "published_date": published,
                    })
                return results
        except Exception as e:
            logger.warning(f"Google CSE search failed: {type(e).__name__}: {e}")
            return []

    @staticmethod
    async def _searxng(session: aiohttp.ClientSession, query: str, n: int) -> List[Dict[str, Any]]:
        # Off unless explicitly pointed at an instance -- public SearxNG
        # instances block anonymous/bot access to their JSON API (verified:
        # every public instance tried returned a bot-check page or 429),
        # so this only does anything useful against a self-hosted one.
        instance = os.getenv("SEARXNG_URL")
        if not instance:
            return []
        api_key = os.getenv("SEARXNG_API_KEY")
        headers = dict(_VATSA_UA)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        try:
            async with session.get(
                f"{instance.rstrip('/')}/search",
                params={"q": query, "format": "json", "safesearch": 1},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    body = (await resp.text())[:200]
                    logger.warning(f"SearxNG returned {resp.status} from {instance}: {body}")
                    return []
                data = json.loads(await resp.text())
                return [
                    {
                        "title": r.get("title") or "",
                        "url": r.get("url") or "",
                        "snippet": _strip_html(r.get("content", ""))[:500],
                        "provider": "searxng",
                        "published_date": r.get("publishedDate"),
                    }
                    for r in data.get("results", [])[:n]
                ]
        except Exception as e:
            logger.warning(f"SearxNG search failed: {type(e).__name__}: {e}")
            return []

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
            logger.warning(f"Tavily search failed: {type(e).__name__}: {e}")
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
            logger.warning(f"Serper search failed: {type(e).__name__}: {e}")
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
            logger.warning(f"Brave search failed: {type(e).__name__}: {e}")
            return []

    @staticmethod
    async def _wikipedia_summary(session: aiohttp.ClientSession, subject: str) -> List[Dict[str, Any]]:
        """Tries Wikipedia's page-summary API directly on the extracted
        subject first (e.g. "capital Japan" -> redirects to "Tokyo").
        This is a real page lookup, not a keyword search, so it can't
        be fooled by an unrelated page sharing a keyword."""
        try:
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(subject)}"
            async with session.get(url, headers=_VATSA_UA, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                extract = data.get("extract")
                if not extract:
                    return []
                page_url = (data.get("content_urls", {}).get("desktop", {}) or {}).get("page")
                return [{
                    "title": f"{data.get('title', subject)} - Wikipedia",
                    "url": page_url or f"https://en.wikipedia.org/wiki/{quote(subject)}",
                    "snippet": extract[:600],
                    "provider": "wikipedia",
                    "published_date": None,
                }]
        except Exception as e:
            logger.warning(f"Wikipedia summary lookup failed for '{subject}': {type(e).__name__}: {e}")
            return []

    @staticmethod
    async def _wikipedia_search(session: aiohttp.ClientSession, query: str, n: int = 3) -> List[Dict[str, Any]]:
        """Falls back to keyword search when the direct summary lookup
        finds no matching page (e.g. the subject isn't an exact title)."""
        try:
            async with session.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "query", "list": "search", "srsearch": query, "format": "json", "srlimit": n},
                headers=_VATSA_UA,
                timeout=aiohttp.ClientTimeout(total=12),
            ) as resp:
                if resp.status != 200:
                    return []
                data = json.loads(await resp.text())
                hits = data.get("query", {}).get("search", [])
                return [
                    {
                        "title": f"{r['title']} - Wikipedia",
                        "url": f"https://en.wikipedia.org/wiki/{r['title'].replace(' ', '_')}",
                        "snippet": _strip_html(r.get("snippet", ""))[:500],
                        "provider": "wikipedia",
                        "published_date": r.get("timestamp"),
                    }
                    for r in hits
                ]
        except Exception as e:
            logger.warning(f"Wikipedia search failed: {type(e).__name__}: {e}")
            return []

    @staticmethod
    async def _wikipedia(session: aiohttp.ClientSession, query: str) -> List[Dict[str, Any]]:
        subject = _wikipedia_subject(query)
        direct = await SearchService._wikipedia_summary(session, subject)
        if direct:
            return direct
        return await SearchService._wikipedia_search(session, query)

    # ------------------------------------------------------------------
    # Enrichment, ranking, aggregation
    # ------------------------------------------------------------------

    @staticmethod
    async def _enrich_snippet(session: aiohttp.ClientSession, r: Dict[str, Any]) -> None:
        """For a non-Wikipedia top result with a thin snippet, tries to
        pull a fuller description from the page's own meta tags. Best
        effort -- a failure here just leaves the original snippet."""
        if r.get("provider") == "wikipedia" or len(r.get("snippet", "")) >= 200:
            return
        try:
            async with session.get(
                r["url"],
                headers={"User-Agent": "Mozilla/5.0 (compatible; VatsaAI/1.0)"},
                timeout=aiohttp.ClientTimeout(total=6),
                allow_redirects=True,
            ) as resp:
                if resp.status != 200:
                    return
                html = (await resp.text(errors="replace"))[:50000]
                m = _META_DESC_RE.search(html)
                if m and len(m.group(1)) > len(r.get("snippet", "")):
                    r["snippet"] = _strip_html(m.group(1))[:500]
        except Exception:
            pass  # best-effort only

    @staticmethod
    def _rank_score(query_tokens: set, r: Dict[str, Any]) -> float:
        score = 0.0
        title_lower = r.get("title", "").lower()
        content = f"{title_lower} {r.get('snippet', '')}".lower()
        content_tokens = set(_tokenize(content))

        # Token overlap is the primary signal -- does this result even
        # talk about what was asked? This is what a flat authority bonus
        # can't tell you (a .gov page about something unrelated is not
        # better than a Wikipedia page that actually answers the query).
        overlap = len(query_tokens & content_tokens) / max(len(query_tokens), 1)
        score += overlap * 50

        title_tokens = set(_tokenize(title_lower))
        score += len(query_tokens & title_tokens) * 8

        stripped_query = " ".join(sorted(query_tokens))
        if stripped_query and all(t in title_lower for t in query_tokens):
            score += 30  # every query term appears in the title

        score += min(len(r.get("snippet", "")), 500) / 25

        domain = _domain(r.get("url", ""))
        if any(d in domain for d in (".gov", ".edu")):
            score += 8
        elif "wikipedia.org" in domain:
            score += 6
        elif any(d in domain for d in ("reuters.com", "bbc.com", "apnews.com")):
            score += 5

        if r.get("published_date"):
            try:
                published = datetime.fromisoformat(str(r["published_date"]).replace("Z", "+00:00"))
                days_old = (datetime.now(timezone.utc) - published).days
                score += max(0, 15 - days_old) / 3
            except Exception:
                pass

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
    async def _search_once(query: str, max_results: int) -> List[Dict[str, Any]]:
        async with aiohttp.ClientSession() as session:
            tasks = [
                SearchService._duckduckgo(query, max_results),
                SearchService._google_cse(session, query, max_results),
                SearchService._searxng(session, query, max_results),
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
                    for native_rank, r in enumerate(batch):
                        r["native_rank"] = native_rank
                        results.append(r)

            if not results:
                return []

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

            query_tokens = set(_tokenize(query))
            deduped.sort(key=lambda r: SearchService._rank_score(query_tokens, r), reverse=True)
            top = deduped[:max_results]

            # Best-effort snippet enrichment for the top 3 non-Wikipedia
            # results with thin snippets -- run after ranking so we only
            # pay this cost for results that actually made the cut.
            await asyncio.gather(*(SearchService._enrich_snippet(session, r) for r in top[:3]), return_exceptions=True)

            return top

    @staticmethod
    async def search(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Searches DuckDuckGo (always) plus any configured providers, in
        parallel, across the original query and up to one targeted
        rephrasing (e.g. "capital of X" -> "X capital city"), then
        dedupes and ranks the combined results by how well they answer
        the query -- not just by domain authority -- before returning
        the top `max_results` with citation-ready metadata (index,
        domain, quality, favicon). Raises RuntimeError if every
        provider came back empty.
        """
        variations = _expand_query(query)
        batches = await asyncio.gather(*(SearchService._search_once(v, max_results) for v in variations))

        combined: List[Dict[str, Any]] = []
        for batch in batches:
            combined.extend(batch)

        if not combined:
            raise RuntimeError("No search results available (all providers failed or returned nothing).")

        seen_urls, seen_titles, deduped = set(), set(), []
        for r in combined:
            url_key = _domain(r["url"]) + urlparse(r["url"]).path.rstrip("/")
            title_key = _normalize_title(r["title"])
            if url_key in seen_urls or title_key in seen_titles:
                continue
            seen_urls.add(url_key)
            seen_titles.add(title_key)
            deduped.append(r)

        query_tokens = set(_tokenize(query))
        deduped.sort(key=lambda r: SearchService._rank_score(query_tokens, r), reverse=True)
        top = deduped[:max_results]

        for i, r in enumerate(top, 1):
            r["index"] = i
            r["domain"] = _domain(r["url"])
            r["quality"] = SearchService._quality(r["url"])
            r["favicon"] = f"https://www.google.com/s2/favicons?domain={r['domain']}&sz=32"
            # A scraped result can occasionally carry a mangled title
            # (a provider's own carousel/related-links card concatenated
            # into one string) -- cap it rather than show garbage.
            title = r.get("title", "")
            if len(title) > 100:
                r["title"] = title[:97] + "..."
            r.pop("provider", None)  # never expose which backend served this
            r.pop("native_rank", None)  # internal ranking signal only

        return top

    @staticmethod
    def format_context(results: List[Dict[str, Any]], original_query: str = "") -> str:
        if not results:
            return ""
        lines = ["=== LIVE WEB SEARCH RESULTS ==="]
        for r in results:
            date = f" ({r['published_date']})" if r.get("published_date") else ""
            lines.append(f"\n[{r['index']}] {r['title']}{date}")
            lines.append(f"URL: {r['url']}")
            lines.append(r.get("snippet", ""))
        lines.append(
            f"\n=== INSTRUCTIONS ===\n"
            f"The user's question: \"{original_query}\"\n"
            "- Use ONLY the sources above.\n"
            "- If the answer IS stated in any source, use it -- never claim the sources "
            "don't contain the answer when they do; read all of them carefully first.\n"
            "- Cite sources inline as [1], [2], etc. Cite every source that supports a claim: [1][2].\n"
            "- If sources disagree, say so explicitly rather than silently picking one.\n"
            "- If the sources genuinely don't answer the question, say you couldn't find "
            "reliable sources -- never invent facts.\n"
        )
        return "\n".join(lines)
