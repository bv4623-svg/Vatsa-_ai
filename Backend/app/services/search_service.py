"""
Web search grounding for chat, via Tavily (https://tavily.com) -- a
search API purpose-built for feeding results to an LLM. Degrades
gracefully everywhere: when TAVILY_API_KEY isn't set, or the provider
call fails, callers get None/raise and continue the chat without
search rather than breaking the whole response.
"""
import os
import json
import logging
from typing import List, Dict, Any
import aiohttp

logger = logging.getLogger("SearchService")

TAVILY_URL = "https://api.tavily.com/search"


class SearchService:
    @staticmethod
    def is_configured() -> bool:
        key = os.getenv("TAVILY_API_KEY", "")
        return bool(key) and not key.startswith("your-") and key != "placeholder"

    @staticmethod
    async def search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """
        Returns [{"title", "url", "snippet"}, ...]. Raises RuntimeError if
        search isn't configured or the provider call fails -- callers
        should catch this and proceed without search context.
        """
        if not SearchService.is_configured():
            raise RuntimeError("Web search is not configured on this server.")

        api_key = os.getenv("TAVILY_API_KEY")
        payload = {
            "api_key": api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                TAVILY_URL, json=payload, timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                raw = await resp.read()
                body = raw.decode("utf-8", errors="replace")
                if resp.status != 200:
                    raise RuntimeError(f"Search provider error [{resp.status}]: {body}")
                data = json.loads(body)

        results = []
        for r in (data.get("results") or [])[:max_results]:
            results.append({
                "title": r.get("title", "") or "",
                "url": r.get("url", "") or "",
                "snippet": (r.get("content", "") or "")[:500],
            })
        return results

    @staticmethod
    def format_context(results: List[Dict[str, str]]) -> str:
        if not results:
            return ""
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r['title']}\n{r['url']}\n{r['snippet']}")
        return "\n\n".join(lines)
