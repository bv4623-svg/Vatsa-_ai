from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union, AsyncGenerator, Tuple
from datetime import datetime
import json
import logging
import uuid

import os

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.auth.jwt import create_media_token
from app.services.ai_service import AIService, detect_image_gen
from app.services.image_service import generate_and_store_image
from app.services.memory_extractor import extract_facts
from app.services.library import sync_conversation_item, check_quota
from app.services.memory_service import MemoryService
from app.services.search_service import SearchService
from app.services.feature_access import check_daily_limit, increment_usage

BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://127.0.0.1:8000")

logger = logging.getLogger("ChatRouter")
router = APIRouter(prefix="/api", tags=["chat"])


def _extract_and_save_memory(user_id: int, message_text: str) -> None:
    """
    Runs after the response has already been sent (via BackgroundTasks),
    so extraction never adds latency to the chat request. Uses its own
    DB session -- the request-scoped session from `get_db` is closed by
    the time this runs.
    """
    db = SessionLocal()
    try:
        facts = extract_facts(message_text)
        for fact in facts:
            try:
                MemoryService.upsert_memory(
                    db,
                    user_id=user_id,
                    mem_type=fact["type"],
                    category=fact["category"],
                    content=fact["content"],
                    confidence=fact.get("confidence", 0.8),
                )
            except Exception as e:
                logger.warning(f"Failed to save extracted memory for user {user_id}: {e}")
    except Exception as e:
        logger.warning(f"Memory extraction failed for user {user_id}: {e}")
    finally:
        db.close()

class ChatRequest(BaseModel):
    message: str
    # Ownership always comes from the authenticated session (see get_current_user
    # below) -- a client-supplied user_id/userId is never trusted for identity.
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    preferred_model: Optional[str] = Field(None, alias="preferredModel")
    workspace: Optional[str] = "chat"
    attachments: Optional[List[Union[str, Dict[str, Any]]]] = None
    stream: Optional[bool] = False
    web_search: Optional[bool] = Field(False, alias="webSearch")
    reasoning: Optional[bool] = False
    model_config = {"populate_by_name": True}


def _load_history(req: ChatRequest, user: User, db: Session) -> Tuple[Optional[Conversation], List[Dict[str, Any]]]:
    if not req.conversation_id:
        return None, []
    conv = db.query(Conversation).filter_by(id=req.conversation_id, user_id=user.id).first()
    history = list(conv.messages) if conv and conv.messages else []
    return conv, history


def _parse_attachments(req: ChatRequest) -> List[Dict[str, Any]]:
    """
    Normalizes the client's attachment shape into what AIService._build_messages
    expects: {"filename", "text"} for documents (already extracted client-side
    via /api/upload or read as plain text) and {"filename", "image_data_url"}
    for images, so the model can actually see them instead of the attachment
    being a UI-only decoration.
    """
    parsed = []
    if req.attachments:
        for att in req.attachments:
            if not isinstance(att, dict):
                continue
            if att.get("text"):
                parsed.append({"filename": att.get("name", "file"), "text": att["text"]})
            elif att.get("is_base64") and str(att.get("type", "")).startswith("image/") and att.get("content"):
                parsed.append({"filename": att.get("name", "image"), "image_data_url": att["content"]})
    return parsed


def _enforce_daily_limit(db: Session, user: User, feature: str) -> None:
    """
    Raises 429 (with the shape the frontend's upgrade UI expects) once a
    user's free/pro/ultra daily cap for `feature` is hit, else records
    this call against today's count. Chat and Code share one endpoint
    (distinguished only by req.workspace in the body), so this can't be
    a route-level dependency the way vision's require_feature() is --
    it has to run after the request body is parsed.
    """
    allowed, used, limit = check_daily_limit(db, user, feature)
    if not allowed:
        raise HTTPException(status_code=429, detail={
            "error": "daily_limit_reached",
            "feature": feature,
            "used": used,
            "limit": limit,
            "resets_at": "midnight UTC",
            "upgrade_url": "/pricing",
        })
    increment_usage(db, user, feature)


def _enforce_storage_quota(db: Session, user: User, estimated_bytes: int) -> None:
    """Raises 413 before generating an image that would push the user over
    their plan's storage ceiling. Checked here rather than inside
    generate_and_store_image() because that function's caller wraps every
    exception in a generic 502 -- this must run, and raise, before that
    try block."""
    allowed, usage = check_quota(db, user, estimated_bytes)
    if not allowed:
        raise HTTPException(status_code=413, detail={
            "error": "storage_limit_reached",
            "used_bytes": usage["used_bytes"],
            "limit_bytes": usage["limit_bytes"],
            "upgrade_url": "/pricing",
        })


async def _get_search_context(req: ChatRequest, user: User, db: Session) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Best-effort multi-source web search grounding. Never raises -- if no
    provider is configured/reachable, or the user's daily search quota
    is used up, the chat just proceeds without it rather than breaking
    the whole response over an optional feature.
    Returns (formatted_context_for_the_prompt, raw_results_for_the_client).
    """
    if not req.web_search:
        return None, []
    allowed, used, limit = check_daily_limit(db, user, "web_search")
    if not allowed:
        logger.info(f"Web search daily limit reached for user {user.id} ({used}/{limit})")
        return None, []
    try:
        results = await SearchService.search(req.message)
        increment_usage(db, user, "web_search")
        return SearchService.format_context(results, req.message), results
    except Exception as e:
        logger.warning(f"Web search unavailable for user {user.id}: {e}")
        return None, []


def _persist_conversation(
    conv: Optional[Conversation],
    db: Session,
    user_message: str,
    assistant_text: str,
    model_name: str = "Vatsa AI",
    image_url: Optional[str] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
    reasoning_text: Optional[str] = None,
) -> None:
    if not conv:
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


async def _stream_chat_response(
    req: ChatRequest,
    user: User,
    db: Session,
    conv: Optional[Conversation],
    history_messages: List[Dict[str, Any]],
    parsed_attachments: List[Dict[str, Any]],
    chosen_model: str,
    workspace: str,
    background_tasks: BackgroundTasks,
    search_context: Optional[str] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
    reasoning: bool = False,
) -> AsyncGenerator[str, None]:
    full_text = ""
    reasoning_text = ""
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    try:
        async for event in AIService.stream_response(
            db=db,
            user=user,
            query=req.message,
            conversation_history=history_messages,
            model_name=chosen_model,
            workspace=workspace,
            attachments=parsed_attachments,
            search_context=search_context,
            reasoning=reasoning,
        ):
            if "thinking" in event:
                yield f"data: {json.dumps({'thinking': event['thinking']})}\n\n"
            elif "delta" in event:
                yield f"data: {json.dumps({'delta': event['delta']})}\n\n"
            elif "error" in event:
                logger.warning(f"Stream error for user {user.id}: {event['error']}")
                yield f"data: {json.dumps({'error': event['error']})}\n\n"
                return
            elif event.get("done"):
                full_text = event["content"]
                reasoning_text = event.get("reasoning", "")
                usage = event["usage"]
    except Exception as e:
        # Never forward exception text to the client -- may name a
        # provider/model (see ai_service.py). Log server-side only.
        logger.error(f"Stream error for user {user.id}: {e}")
        yield f"data: {json.dumps({'error': 'AI service is temporarily unavailable. Please try again.'})}\n\n"
        return

    if full_text:
        _persist_conversation(conv, db, req.message, full_text, "Vatsa AI", sources=sources, reasoning_text=reasoning_text)
        background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

    done_event: Dict[str, Any] = {"done": True, "usage": usage, "conversation_id": req.conversation_id}
    if sources:
        done_event["sources"] = sources
    if reasoning_text:
        done_event["reasoning"] = reasoning_text
    yield f"data: {json.dumps(done_event)}\n\n"


@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chosen_model = req.model or req.preferred_model or "auto"
    workspace = req.workspace or "chat"

    # --- 1. Image Generation Check (instant, single-shot -- never streamed;
    # the streaming frontend clients already fall back to plain JSON when
    # the response isn't text/event-stream, so this stays consistent even
    # when the caller asked for stream=true). ---
    img_prompt = detect_image_gen(req.message)
    if img_prompt:
        _enforce_daily_limit(db, user, "image_gen")
        # A processed PNG from this pipeline is typically 1-3MB; 2MB is a
        # conservative pre-check so a user right at their ceiling is
        # blocked before spending the generation call, not after.
        _enforce_storage_quota(db, user, 2 * 1024 * 1024)
        try:
            img_data = await generate_and_store_image(db, user.id, img_prompt)
        except Exception as e:
            logger.error(f"Image generation failed for user {user.id}: {e}")
            raise HTTPException(status_code=502, detail="Image generation is temporarily unavailable. Please try again.")

        media_token = create_media_token(user.id)
        image_url = f"{BACKEND_PUBLIC_URL}/api/files/{img_data['image_id']}/preview?token={media_token}"
        response_text = f"**Vatsa AI Image**\n\n![image]({image_url})"

        conv, _ = _load_history(req, user, db)
        _persist_conversation(conv, db, req.message, response_text, image_url=image_url)
        background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

        return {
            "status": "success",
            "query": req.message,
            "response": response_text,
            "selected_model": "Vatsa AI",
            "provider": "Vatsa AI",
            "image_url": image_url,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "vis": 100,
            "primary_intent": "image_generation"
        }

    # --- 2. Daily message-limit check (per workspace) ---
    _enforce_daily_limit(db, user, "code_messages" if workspace == "code" else "chat_messages")

    # --- 3. Load Conversation History + Attachments ---
    conv, history_messages = _load_history(req, user, db)
    parsed_attachments = _parse_attachments(req)
    search_context, sources = await _get_search_context(req, user, db)

    # --- 3. Streaming path ---
    if req.stream:
        return StreamingResponse(
            _stream_chat_response(
                req, user, db, conv, history_messages, parsed_attachments,
                chosen_model, workspace, background_tasks, search_context, sources,
                req.reasoning,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # --- 4. Non-streaming path (unchanged behavior, plus sources/reasoning when present) ---
    try:
        result = await AIService.generate_response(
            db=db,
            user=user,
            query=req.message,
            conversation_history=history_messages,
            model_name=chosen_model,
            workspace=workspace,
            attachments=parsed_attachments,
            search_context=search_context,
            reasoning=req.reasoning,
        )
    except ValueError as ve:
        raise HTTPException(status_code=402, detail=str(ve))
    except Exception as e:
        # Log the real error (may name a provider/model) server-side only;
        # never forward exception text to the client -- it can contain
        # upstream provider/model identifiers (see ai_service.py).
        logger.error(f"AI service error for user {user.id}: {e}")
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable. Please try again.")

    if sources:
        result["sources"] = sources
    _persist_conversation(
        conv, db, req.message, result["response"], result["selected_model"],
        sources=sources, reasoning_text=result.get("reasoning"),
    )
    background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

    return result


@router.post("/chat/stream")
async def chat_stream_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dedicated always-streaming route. Same logic as /api/chat with stream=true."""
    req.stream = True
    return await chat_endpoint(req, background_tasks, user, db)


# Non-streaming send endpoint (used by chat.ts service)
@router.post("/chat/send")
async def send_message_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Same logic as chat_endpoint but without streaming
    req.stream = False
    return await chat_endpoint(req, background_tasks, user, db)
