from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import logging
import uuid

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.services.ai_service import AIService, detect_image_gen, generate_image
from app.services.memory_extractor import extract_facts
from app.services.memory_service import MemoryService

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
    model_config = {"populate_by_name": True}

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

    # --- 1. Image Generation Check ---
    img_prompt = detect_image_gen(req.message)
    if img_prompt:
        img_data = await generate_image(img_prompt)
        response_text = f"**Vatsa AI Image**\n\n![image]({img_data['image_url']})"

        # Save to conversation if provided
        if req.conversation_id:
            conv = db.query(Conversation).filter_by(id=req.conversation_id, user_id=user.id).first()
            if conv:
                msgs = list(conv.messages or [])
                now = datetime.utcnow().isoformat()
                msgs.append({"id": f"msg_{uuid.uuid4().hex[:8]}", "role": "user", "content": req.message, "createdAt": now})
                msgs.append({"id": f"msg_{uuid.uuid4().hex[:8]}", "role": "assistant", "content": response_text, "createdAt": now, "imageUrl": img_data["image_url"]})
                conv.messages = msgs
                conv.updated_at = datetime.utcnow()
                db.commit()

        background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

        return {
            "status": "success",
            "query": req.message,
            "response": response_text,
            "selected_model": "Vatsa AI",
            "provider": "Vatsa AI",
            "image_url": img_data["image_url"],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "vis": 100,
            "primary_intent": "image_generation"
        }

    # --- 2. Load Conversation History ---
    history_messages = []
    conv = None
    if req.conversation_id:
        conv = db.query(Conversation).filter_by(id=req.conversation_id, user_id=user.id).first()
        if conv and conv.messages:
            history_messages = list(conv.messages)

    # --- 3. Parse Attachments ---
    parsed_attachments = []
    if req.attachments:
        for att in req.attachments:
            if isinstance(att, dict) and att.get("text"):
                parsed_attachments.append({"filename": att.get("name", "file"), "text": att["text"]})

    # --- 4. Call AI Service ---
    try:
        result = await AIService.generate_response(
            db=db,
            user=user,
            query=req.message,
            conversation_history=history_messages,
            model_name=chosen_model,
            workspace=workspace,
            attachments=parsed_attachments
        )
    except ValueError as ve:
        raise HTTPException(status_code=402, detail=str(ve))
    except Exception as e:
        # Log the real error (may name a provider/model) server-side only;
        # never forward exception text to the client -- it can contain
        # upstream provider/model identifiers (see ai_service.py).
        logger.error(f"AI service error for user {user.id}: {e}")
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable. Please try again.")

    # --- 5. Persist to Conversation ---
    if conv:
        msgs = list(conv.messages or [])
        now = datetime.utcnow().isoformat()
        msgs.append({
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "role": "user",
            "content": req.message,
            "createdAt": now
        })
        msgs.append({
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "role": "assistant",
            "content": result["response"],
            "model": result["selected_model"],
            "createdAt": now
        })
        conv.messages = msgs
        conv.updated_at = datetime.utcnow()
        db.commit()

    background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

    return result

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
