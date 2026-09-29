"""Live integration tests against the REAL providers.

Off by default. They run only when you opt in AND the provider's key (if it
needs one) is set:

    VATSA_LIVE_TESTS=1 OPENROUTER_API_KEY=... python -m pytest -m live -rs

Every skip prints why (pytest -rs). Once opted in, an unreachable provider
or an error response FAILS the test; nothing passes by default. Normal runs
(and CI) report them as skipped.

What each test proves against the real service:
- chat: a real completion, buffered and streamed, through the fallback chain
- vision: the vision model describes a generated image correctly
- deep research: planning + real web search + a cited report
- image generation: the real image provider returns a decodable image
- web search: DuckDuckGo (key-less) and each optional keyed provider
"""
import asyncio
import io
import os

import pytest
from PIL import Image

pytestmark = pytest.mark.live

OPT_IN = os.getenv("VATSA_LIVE_TESTS") == "1"
OPT_IN_REASON = "live provider test: set VATSA_LIVE_TESTS=1 to run against the real service"


def _require(*env_vars: str):
    """Skip (with the reason) unless opted in and every env var is set."""
    if not OPT_IN:
        pytest.skip(OPT_IN_REASON)
    missing = [v for v in env_vars if not os.getenv(v)]
    if missing:
        pytest.skip(f"live provider test: {', '.join(missing)} not set")


def _run(coro):
    return asyncio.run(coro)


# ---- chat (OpenRouter) ----------------------------------------------------------

def _router():
    """The real router, built from this environment (not a test fake)."""
    from app.ai_router import get_router, reset_router
    reset_router()
    return get_router()


def test_live_chat_completion():
    _require("OPENROUTER_API_KEY")
    from app.ai_router.types import RouteRequest
    result = _run(_router().generate(RouteRequest(
        messages=[{"role": "user", "content": "Reply with exactly the word: pong"}],
        route="auto", max_tokens=10, temperature=0,
    )))
    assert "pong" in result.content.lower(), result.content
    assert result.usage and result.usage.total_tokens > 0


def test_live_chat_streaming():
    _require("OPENROUTER_API_KEY")
    from app.ai_router.types import RouteRequest

    async def collect():
        text = ""
        async for evt in _router().stream(RouteRequest(
            messages=[{"role": "user", "content": "Count from 1 to 5 separated by spaces."}],
            route="auto", max_tokens=30, temperature=0,
        )):
            if evt.type.value == "delta":
                text += evt.content
        return text

    text = _run(collect())
    assert all(str(n) in text for n in range(1, 6)), text


# ---- vision (OpenRouter vision model) ----------------------------------------------

def test_live_vision_describes_image():
    _require("OPENROUTER_API_KEY")
    import base64
    from app.ai_router.types import Capability, RouteRequest
    from app.routers.vision import _ANALYSIS_PROMPT, _parse_vision_response
    buf = io.BytesIO()
    Image.new("RGB", (256, 256), (220, 20, 20)).save(buf, format="PNG")
    url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    result = _run(_router().generate(RouteRequest(
        messages=[{"role": "user", "content": [
            {"type": "text", "text": "What single colour fills this image? " + _ANALYSIS_PROMPT},
            {"type": "image_url", "image_url": {"url": url}},
        ]}],
        route="vision", max_tokens=300, required=frozenset({Capability.CHAT, Capability.VISION}),
    )))
    parsed = _parse_vision_response(result.content)
    assert "red" in (parsed["description"] + " ".join(parsed["tags"])).lower(), parsed


# ---- deep research (OpenRouter + live web search) -------------------------------------

def test_live_deep_research_end_to_end():
    _require("OPENROUTER_API_KEY")
    from app.services.research_service import run_research

    async def collect():
        return [e async for e in run_research("What is the capital of Japan and its population?")]

    events = _run(collect())
    assert [e["stage"] for e in events if "stage" in e] == ["planning", "searching", "writing"], events[-1]
    done = events[-1]
    assert done.get("done"), done
    assert done["sources"], "research must cite at least one real source"
    assert "tokyo" in done["content"].lower()
    assert "[1]" in done["content"]


# ---- image generation (key-less provider) ------------------------------------------------

def test_live_image_generation():
    _require()
    from app.services import image_service
    raw = _run(image_service._fetch_raw_image("a small red apple on a white table"))
    img = Image.open(io.BytesIO(raw))
    img.load()
    assert img.size[0] >= 256 and img.size[1] >= 256
    processed = image_service._process_image(raw)
    assert Image.open(io.BytesIO(processed)).format == "PNG"


# ---- web search -----------------------------------------------------------------------

def test_live_duckduckgo_search():
    _require()
    from app.services.search_service import SearchService, clear_search_cache
    clear_search_cache()
    results = _run(SearchService._duckduckgo("capital of Japan", 5))
    assert results, "DuckDuckGo returned no results"
    assert any("tokyo" in (r["title"] + r["snippet"]).lower() for r in results)


def test_live_wikipedia_lookup():
    _require()
    import aiohttp
    from app.services.search_service import SearchService

    async def go():
        async with aiohttp.ClientSession() as s:
            return await SearchService._wikipedia(s, "What is the capital of Japan?")

    results = _run(go())
    assert results and "wikipedia.org" in results[0]["url"]


@pytest.mark.parametrize("provider,env", [
    ("_serper", "SERPER_API_KEY"),
    ("_tavily", "TAVILY_API_KEY"),
    ("_brave", "BRAVE_API_KEY"),
    ("_google_cse", "GOOGLE_CSE_API_KEY"),
    ("_searxng", "SEARXNG_URL"),
])
def test_live_optional_search_provider(provider, env):
    _require(env)
    import aiohttp
    from app.services.search_service import SearchService

    async def go():
        async with aiohttp.ClientSession() as s:
            return await getattr(SearchService, provider)(s, "capital of Japan", 5)

    results = _run(go())
    # These providers swallow errors and return [] (so chat degrades
    # gracefully); here an empty list means the key or instance is broken.
    assert results, f"{provider} returned nothing: check {env}"
