"""POST /api/research -- streamed deep research (Business plan).

Server-sent events, one JSON object per `data:` line:
  {"stage": "planning"} | {"stage": "searching", "queries": [...]} |
  {"stage": "writing", "source_count": n} | {"delta": "..."} |
  {"done": true, "sources": [...], "queries": [...], "usage": {...}, "conversation_id": ...} |
  {"error": "...", "code": "...", "retryable": bool}
"""
import json
import logging
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conversation import Conversation
from app.models.user import User
from app.routers.chat import _persist_conversation
from app.services.ai_service import PUBLIC_MODEL_NAME
from app.services.feature_access import increment_usage, require_feature
from app.services.research_service import ESTIMATED_TOKENS, run_research
from app.services.token_service import TokenService

logger = logging.getLogger("ResearchRouter")
router = APIRouter(prefix="/api", tags=["research"])

MAX_QUESTION_CHARS = 2000


class ResearchRequest(BaseModel):
    message: str = Field(..., max_length=MAX_QUESTION_CHARS)
    conversation_id: Optional[str] = None


def _sse(event: Dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _research_log(queries, source_count: int) -> str:
    lines = ["Planned searches:"] + [f"- {q}" for q in queries] + [f"Read {source_count} sources."]
    return "\n".join(lines)


async def _stream(req: ResearchRequest, user: User, db: Session, conv: Optional[Conversation]) -> AsyncGenerator[str, None]:
    try:
        async for event in run_research(req.message, user.full_name or None):
            if not event.get("done"):
                yield _sse(event)
                if "error" in event:
                    return
                continue

            increment_usage(db, user, "deep_research")
            TokenService.deduct_tokens(
                db=db, user_id=user.id, tokens=event["usage"]["total_tokens"],
                reason="Deep research", model=PUBLIC_MODEL_NAME,
            )
            _persist_conversation(
                conv, db, req.message, event["content"], PUBLIC_MODEL_NAME,
                sources=event["sources"],
                reasoning_text=_research_log(event["queries"], len(event["sources"])),
                user_settings=user.settings,
            )
            yield _sse({
                "done": True,
                "sources": event["sources"],
                "queries": event["queries"],
                "usage": event["usage"],
                "conversation_id": req.conversation_id,
            })
    except Exception as e:
        logger.exception(f"Research failed for user {user.id}: {e}")
        yield _sse({"error": "Research failed unexpectedly. Please try again.", "code": "internal", "retryable": True})


@router.post("/research")
async def research_endpoint(
    req: ResearchRequest,
    # charge=False: the daily allowance is used only by a finished report.
    user: User = Depends(require_feature("deep_research", charge=False)),
    db: Session = Depends(get_db),
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    allowed, reason = TokenService.check_allowance(db, user, estimated_tokens=ESTIMATED_TOKENS)
    if not allowed:
        raise HTTPException(status_code=402, detail=reason)

    conv = None
    if req.conversation_id:
        conv = db.query(Conversation).filter_by(id=req.conversation_id, user_id=user.id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

    return StreamingResponse(
        _stream(req, user, db, conv),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
