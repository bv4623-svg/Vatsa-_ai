import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.services.library import sync_conversation_item
from app.routers.chat.router import logger


def _persist_conversation(
    conv: Optional[Conversation],
    db: Session,
    user_message: str,
    assistant_text: str,
    model_name: str = "Vatsa AI",
    image_url: Optional[str] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
    reasoning_text: Optional[str] = None,
    user_settings: Optional[Dict[str, Any]] = None,
) -> None:
    if not conv:
        return
    # Real effect, not a stored-but-ignored flag: with auto-save off, the
    # exchange is returned to the caller (already happened by this point)
    # but never written to the conversation, so a refresh shows it gone.
    if user_settings is not None and user_settings.get("autoSaveChats", True) is False:
        return
    msgs = list(conv.messages or [])
    now = datetime.utcnow().isoformat()
    msgs.append({"id": f"msg_{uuid.uuid4().hex[:8]}", "role": "user", "content": user_message, "createdAt": now})
    assistant_msg = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "role": "assistant",
        "content": assistant_text,
        "model": model_name,
        "createdAt": now,
    }
    if image_url:
        assistant_msg["imageUrl"] = image_url
    if sources:
        assistant_msg["sources"] = sources
    if reasoning_text:
        assistant_msg["thinking"] = reasoning_text
    msgs.append(assistant_msg)
    conv.messages = msgs
    conv.updated_at = datetime.utcnow()
    db.commit()

    # Every chat/code conversation is a Library item, kept in sync here --
    # the one place a finished exchange gets persisted, regardless of
    # which of the three call sites (streaming, non-streaming, image gen)
    # triggered it. Never blocks the response: a Library sync failure
    # must not break the chat the user is actually waiting on.
    try:
        sync_conversation_item(
            db, conv.user_id, conv.id, conv.title, conv.workspace or "chat",
            len(json.dumps(msgs, default=str).encode("utf-8")),
        )
    except Exception:
        logger.exception("Library sync failed for conversation %s", conv.id)
