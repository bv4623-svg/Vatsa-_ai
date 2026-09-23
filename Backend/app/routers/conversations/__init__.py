"""Conversation CRUD, pin/favorite/archive flags, and duplication.

Split into router.py (shared APIRouter), schemas.py, crud.py
(list/create/get), mutations.py (update/delete), flags.py and
duplicate.py. `router` is re-exported here so
`app.routers.conversations.router` (as used by app/main.py) keeps
working unchanged.
"""
from app.routers.conversations.router import router
from app.routers.conversations.schemas import CreateConvRequest, UpdateConvRequest
from app.routers.conversations import crud, mutations, flags, duplicate  # noqa: F401
from app.routers.conversations.crud import list_conversations, create_conversation, get_conversation
from app.routers.conversations.mutations import (
    update_conversation, delete_conversation, delete_all_conversations,
)
from app.routers.conversations.flags import (
    pin_conversation, unpin_conversation, fav_conversation,
    unfav_conversation, archive_conversation,
)
from app.routers.conversations.duplicate import duplicate_conversation

__all__ = [
    "router", "CreateConvRequest", "UpdateConvRequest",
    "list_conversations", "create_conversation", "get_conversation",
    "update_conversation", "delete_conversation", "delete_all_conversations",
    "pin_conversation", "unpin_conversation", "fav_conversation",
    "unfav_conversation", "archive_conversation", "duplicate_conversation",
]
