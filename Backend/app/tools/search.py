# app/tools/search.py
"""
Professional Search Tool for Vatsa Router.
Supports Tavily, SerpAPI, and DuckDuckGo.
Includes local caching, retries, and structured results.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode
from collections import OrderedDict

import aiohttp
from aiohttp import ClientTimeout, ClientSession, TCPConnector

# ✅ Sahi import – ab `.base` se
from .base import BaseTool

logger = logging.getLogger(__name__)

# ============================================================================
# Local Simple Cache (to avoid external dependencies)
# ============================================================================

class SimpleCache:
    """Simple in-memory cache with TTL and max size."""
    def __init__(self, maxsize=100, ttl=3600):
        self._cache = OrderedDict()
        self.maxsize = maxsize
        self.ttl = ttl

    def get(self, key):
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self.ttl:
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key, value):
        if key in self._cache:
            del self._cache[key]
        self._cache[key] = (value, time.time())
        if len(self._cache) > self.maxsize:
            self._cache.popitem(last=False)

# ============================================================================
# Configuration
# ============================================================================

class SearchConfig:
    PROVIDER = os.getenv("SEARCH_PROVIDER", "tavily")
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
    SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
    DUCKDUCKGO_ENABLED = os.getenv("DUCKDUCKGO_ENABLED", "true").lower() == "true"

    CACHE_TTL = int(os.getenv("SEARCH_CACHE_TTL", "3600"))
    CACHE_MAX_SIZE = int(os.getenv("SEARCH_CACHE_MAX_SIZE", "100"))

    TIMEOUT = int(os.getenv("SEARCH_TIMEOUT", "15"))
    MAX_RETRIES = int(os.getenv("SEARCH_MAX_RETRIES", "3"))
    RETRY_DELAY = float(os.getenv("SEARCH_RETRY_DELAY", "1.0"))
    MAX_RESULTS = int(os.getenv("SEARCH_MAX_RESULTS", "10"))

class SearchError(Exception):
    pass

# ============================================================================
# Base Search Provider
# ============================================================================

class SearchProvider:
    def __init__(self, config: SearchConfig):
        self.config = config
        self._session: Optional[ClientSession] = None

    async def _get_session(self) -> ClientSession:
        if self._session is None or self._session.closed:
            timeout = ClientTimeout(total=self.config.TIMEOUT)
            connector = TCPConnector(limit=10, limit_per_host=2)
            self._session = ClientSession(timeout=timeout, connector=connector)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def search(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        raise NotImplementedError

# ============================================================================
# Concrete Providers
# ============================================================================

class TavilyProvider(SearchProvider):
    async def search(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        api_key = self.config.TAVILY_API_KEY
        if not api_key:
            raise SearchError("TAVILY_API_KEY not set.")
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": max_results,
            "include_answer": False,
            "include_images": False,
            "include_raw_content": False,
        }
        session = await self._get_session()
        try:
            async with session.post(url, json=payload) as resp:
                resp.raise_for_status()
                data = await resp.json()
                results = data.get("results", [])
                cleaned = []
                for item in results:
                    cleaned.append({
                        "title": item.get("title", ""),
                        "snippet": item.get("content", ""),
                        "url": item.get("url", ""),
                        "source": item.get("domain", ""),
                    })
                return cleaned
        except aiohttp.ClientError as e:
            raise SearchError(f"Tavily search failed: {e}")

class SerpAPIProvider(SearchProvider):
    async def search(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        api_key = self.config.SERPAPI_API_KEY
        if not api_key:
            raise SearchError("SERPAPI_API_KEY not set.")
        params = {"q": query, "api_key": api_key, "num": max_results, "engine": "google"}
        url = f"https://serpapi.com/search?{urlencode(params)}"
        session = await self._get_session()
        try:
            async with session.get(url) as resp:
                resp.raise_for_status()
                data = await resp.json()
                organic = data.get("organic_results", [])
                cleaned = []
                for item in organic[:max_results]:
                    cleaned.append({
                        "title": item.get("title", ""),
                        "snippet": item.get("snippet", ""),
                        "url": item.get("link", ""),
                        "source": item.get("source", ""),
                    })
                return cleaned
        except aiohttp.ClientError as e:
            raise SearchError(f"SerpAPI search failed: {e}")

class DuckDuckGoProvider(SearchProvider):
    async def search(self, query: str, max_results: int = 10) -> List[Dict[str, str]]:
        url = "https://api.duckduckgo.com/"
        params = {"q": query, "format": "json", "no_html": 1, "skip_disambig": 1, "t": "VatsaAI"}
        session = await self._get_session()
        try:
            async with session.get(url, params=params) as resp:
                resp.raise_for_status()
                data = await resp.json()
                results = []
                if data.get("AbstractText"):
                    results.append({
                        "title": data.get("AbstractSource", ""),
                        "snippet": data.get("AbstractText", ""),
                        "url": data.get("AbstractURL", ""),
                        "source": data.get("AbstractSource", ""),
                    })
                for topic in data.get("RelatedTopics", []):
                    if "Text" in topic:
                        results.append({
                            "title": topic.get("Text", "").split("-")[0].strip(),
                            "snippet": topic.get("Text", ""),
                            "url": topic.get("FirstURL", ""),
                            "source": "DuckDuckGo",
                        })
                return results[:max_results]
        except aiohttp.ClientError as e:
            raise SearchError(f"DuckDuckGo search failed: {e}")

def get_search_provider(config: SearchConfig) -> SearchProvider:
    p = config.PROVIDER.lower()
    if p == "tavily":
        return TavilyProvider(config)
    elif p == "serpapi":
        return SerpAPIProvider(config)
    elif p == "duckduckgo":
        return DuckDuckGoProvider(config)
    else:
        raise ValueError(f"Unsupported provider: {p}")

# ============================================================================
# SearchTool (implements BaseTool)
# ============================================================================

class SearchTool(BaseTool):
    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()
        self._provider: Optional[SearchProvider] = None
        # local cache
        self._cache = SimpleCache(maxsize=self.config.CACHE_MAX_SIZE, ttl=self.config.CACHE_TTL)

    @property
    def name(self) -> str:
        return "search"

    @property
    def description(self) -> str:
        return (
            "Performs a web search. Input: 'query=your search query'. "
            "Returns list of results with title, snippet, URL."
        )

    async def _get_provider(self) -> SearchProvider:
        if self._provider is None:
            self._provider = get_search_provider(self.config)
        return self._provider

    async def execute(self, **kwargs) -> str:
        query = kwargs.get("query")
        if not query:
            return "Error: No search query provided."
        max_results = kwargs.get("max_results", self.config.MAX_RESULTS)

        cache_key = f"search:{query}:{max_results}"
        cached = self._cache.get(cache_key)
        if cached:
            logger.info(f"Search cache hit for: {query[:50]}")
            return self._format_results(cached)

        provider = await self._get_provider()
        for attempt in range(self.config.MAX_RETRIES):
            try:
                results = await provider.search(query, max_results)
                if not results:
                    return "No results found."
                self._cache.set(cache_key, results)
                return self._format_results(results)
            except SearchError as e:
                logger.warning(f"Search attempt {attempt+1} failed: {e}")
                if attempt < self.config.MAX_RETRIES - 1:
                    await asyncio.sleep(self.config.RETRY_DELAY * (2 ** attempt))
                else:
                    return f"Search failed after {self.config.MAX_RETRIES} attempts: {e}"
            except Exception as e:
                logger.error(f"Unexpected search error: {e}")
                return f"An unexpected error occurred: {e}"
        return "Search failed."

    def _format_results(self, results: List[Dict[str, str]]) -> str:
        if not results:
            return "No results found."
        lines = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "Untitled")
            snippet = r.get("snippet", "")
            url = r.get("url", "")
            source = r.get("source", "")
            lines.append(f"{i}. **{title}**")
            if snippet:
                lines.append(f"   {snippet}")
            if url:
                lines.append(f"   🔗 {url}")
            if source:
                lines.append(f"   📁 {source}")
            lines.append("")
        return "\n".join(lines)

    async def close(self):
        if self._provider and hasattr(self._provider, "close"):
            await self._provider.close()

# ============================================================================
# Singleton for easy import
# ============================================================================

search_tool = SearchTool()