"""The /api/chat family: image-gen short-circuit, daily/burst limits,
web-search grounding, streaming and non-streaming generation, and
conversation persistence.

Split into router.py (shared APIRouter + constants), schemas.py
(ChatRequest), memory.py, helpers.py, limits.py, search.py,
persistence.py, streaming.py and image_generation.py (module-level
helpers), and endpoints.py/aliases.py (the three routes). Every
previously-public name is re-exported here so `app.routers.chat.router`,
`from app.routers.chat import CHAT_BURST_LIMIT` (test_chat_burst_limit.py)
and `from app.routers.chat import _persist_conversation`
(services/scheduled_tasks/runner.py) keep working unchanged.
"""
from app.routers.chat.router import router, logger, CHAT_BURST_LIMIT, CHAT_BURST_WINDOW_SECONDS
from app.routers.chat.schemas import ChatRequest
from app.routers.chat.memory import _extract_and_save_memory
from app.routers.chat.helpers import _response_style_instruction, _load_history, _parse_attachments
from app.routers.chat.limits import _enforce_daily_limit, _enforce_storage_quota
from app.routers.chat.search import _get_search_context
from app.routers.chat.persistence import _persist_conversation
from app.routers.chat.streaming import _stream_chat_response
from app.routers.chat.image_generation import _handle_image_generation
from app.routers.chat.non_streaming import _handle_non_streaming
from app.routers.chat import endpoints, aliases  # noqa: F401  (registers the routes)
from app.routers.chat.endpoints import chat_endpoint
from app.routers.chat.aliases import chat_stream_endpoint, send_message_endpoint

__all__ = [
    "router", "logger", "CHAT_BURST_LIMIT", "CHAT_BURST_WINDOW_SECONDS",
    "ChatRequest",
    "_extract_and_save_memory",
    "_response_style_instruction", "_load_history", "_parse_attachments",
    "_enforce_daily_limit", "_enforce_storage_quota",
    "_get_search_context",
    "_persist_conversation",
    "_stream_chat_response",
    "_handle_image_generation",
    "_handle_non_streaming",
    "chat_endpoint", "chat_stream_endpoint", "send_message_endpoint",
]
