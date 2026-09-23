"""OpenRouter adapter. The only place that knows OpenRouter's URL, headers,
response shape or error codes.

Split into parsing.py/adapter.py; every public name is re-exported here so
`from app.ai_router.providers.openrouter import X` keeps working exactly as
it did when this was one file.
"""
from app.ai_router.providers.openrouter.parsing import DEFAULT_BASE_URL, classify_status
from app.ai_router.providers.openrouter.adapter import OpenRouterAdapter

__all__ = ["DEFAULT_BASE_URL", "classify_status", "OpenRouterAdapter"]
