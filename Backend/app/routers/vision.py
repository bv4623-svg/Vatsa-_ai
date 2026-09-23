import re
import json
import base64
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.token_service import TokenService
from app.services.ai_service import PUBLIC_MODEL_NAME
from app.services.feature_access import require_feature
from app.ai_router import get_router
from app.ai_router.errors import RouterError
from app.ai_router.types import Capability, RouteRequest

logger = logging.getLogger("VisionRouter")
router = APIRouter(prefix="/api/vision", tags=["vision"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

_ANALYSIS_PROMPT = (
    "Analyze this image carefully. Respond with ONLY a JSON object (no markdown "
    "fences, no extra commentary) in exactly this shape:\n"
    '{"description": "a detailed description of the scene, mood, and composition", '
    '"tags": ["short", "keyword", "tags"], '
    '"objects": ["key objects or people visible"], '
    '"extracted_text": "any text visible in the image via OCR, or an empty string if none"}'
)

_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def _parse_vision_response(raw: str) -> dict:
    text = (raw or "").strip()
    fence = _FENCE_RE.match(text)
    if fence:
        text = fence.group(1)
    try:
        data = json.loads(text)
        return {
            "description": data.get("description") or "",
            "tags": data.get("tags") or [],
            "objects": data.get("objects") or [],
            "extracted_text": data.get("extracted_text") or "",
        }
    except (json.JSONDecodeError, AttributeError):
        # Model didn't follow the JSON format -- still return something
        # useful rather than failing the whole request over formatting.
        return {"description": text, "tags": [], "objects": [], "extracted_text": ""}


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    prompt: Optional[str] = Form(None),
    user: User = Depends(require_feature("vision")),
    db: Session = Depends(get_db),
):
    """
    One-shot structured image analysis: description, tags, key objects,
    and OCR'd text. Nothing is persisted server-side, so there's no
    resource to isolate between users -- the image and result only ever
    exist within this request/response.
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"Unsupported image type: {content_type}. Use JPEG, PNG, WEBP, or GIF.")

    raw = await file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image too large (max 10 MB).")

    ai_router_engine = get_router()
    estimated_tokens = 1500
    is_premium = ai_router_engine.registry.is_route_premium("vision")
    allowed, reason = TokenService.check_allowance(db, user, estimated_tokens=estimated_tokens, premium=is_premium)
    if not allowed:
        raise HTTPException(status_code=402, detail=reason)

    b64 = base64.b64encode(raw).decode("ascii")
    data_url = f"data:{content_type};base64,{b64}"
    user_prompt = _ANALYSIS_PROMPT if not prompt else f"{prompt}\n\n{_ANALYSIS_PROMPT}"

    messages = [
        {"role": "system", "content": "You are Vatsa AI's vision analysis module. Respond only with the requested JSON."},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    request = RouteRequest(
        messages=messages, route="vision", max_tokens=800,
        required=frozenset({Capability.CHAT, Capability.VISION}), user_id=user.id,
    )
    try:
        result = await ai_router_engine.generate(request)
    except RouterError as e:
        logger.warning(f"Vision analysis failed for user {user.id}: {type(e).__name__}: {e}")
        status = 503 if e.code == "ai_busy" else 502
        raise HTTPException(status_code=status, detail=e.public_message)
    except Exception as e:
        logger.error(f"Vision analysis failed for user {user.id}: {e}")
        raise HTTPException(status_code=502, detail="Image analysis is temporarily unavailable. Please try again.")

    parsed = _parse_vision_response(result.content)

    prompt_tokens = result.usage.prompt_tokens if result.usage else 0
    completion_tokens = result.usage.completion_tokens if result.usage else 0
    total_tokens = prompt_tokens + completion_tokens
    TokenService.deduct_tokens(
        db=db, user_id=user.id, tokens=total_tokens or estimated_tokens,
        reason="Vision analysis", model=PUBLIC_MODEL_NAME,
    )

    return {
        "status": "success",
        "description": parsed["description"],
        "tags": parsed["tags"],
        "objects": parsed["objects"],
        "extracted_text": parsed["extracted_text"],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
        },
    }
