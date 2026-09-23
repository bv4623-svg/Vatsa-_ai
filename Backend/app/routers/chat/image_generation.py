from typing import Optional, Dict, Any

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.auth.jwt import create_media_token
from app.services.ai_service import detect_image_gen
from app.services.image_service import generate_and_store_image
from app.config.urls import BACKEND_PUBLIC_URL  # env BACKEND_PUBLIC_URL, else the live API

from app.routers.chat.schemas import ChatRequest
from app.routers.chat.helpers import _load_history
from app.routers.chat.limits import _enforce_daily_limit, _enforce_storage_quota
from app.routers.chat.memory import _extract_and_save_memory
from app.routers.chat.persistence import _persist_conversation
from app.routers.chat.router import logger


async def _handle_image_generation(
    req: ChatRequest, user: User, db: Session, background_tasks: BackgroundTasks,
) -> Optional[Dict[str, Any]]:
    """Instant, single-shot image generation -- never streamed; the
    streaming frontend clients already fall back to plain JSON when the
    response isn't text/event-stream, so this stays consistent even when
    the caller asked for stream=true. Returns None when req.message isn't
    an image-generation request, else the full chat-endpoint response."""
    img_prompt = detect_image_gen(req.message)
    if not img_prompt:
        return None

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
    _persist_conversation(conv, db, req.message, response_text, image_url=image_url, user_settings=user.settings)
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
