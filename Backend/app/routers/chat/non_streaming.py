from typing import Optional, List, Dict, Any

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.conversation import Conversation
from app.services.ai_service import AIService
from app.ai_router.errors import RouterError

from app.routers.chat.schemas import ChatRequest
from app.routers.chat.memory import _extract_and_save_memory
from app.routers.chat.persistence import _persist_conversation
from app.routers.chat.router import logger


async def _handle_non_streaming(
    req: ChatRequest,
    user: User,
    db: Session,
    background_tasks: BackgroundTasks,
    conv: Optional[Conversation],
    history_messages: List[Dict[str, Any]],
    parsed_attachments: List[Dict[str, Any]],
    chosen_model: str,
    workspace: str,
    search_context: Optional[str],
    sources: List[Dict[str, Any]],
    project_instructions: Optional[str],
    response_style_instructions: Optional[str],
) -> Dict[str, Any]:
    """Non-streaming path (unchanged behavior, plus sources/reasoning when present)."""
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
            project_instructions=project_instructions,
            response_style_instructions=response_style_instructions,
        )
    except ValueError as ve:
        raise HTTPException(status_code=402, detail=str(ve))
    except RouterError as e:
        # e.public_message / str(e) are already safe to show a user -- the
        # router never lets a raw provider error or model name reach here.
        logger.warning(f"Router error for user {user.id}: {type(e).__name__}: {e}")
        status_code = 503 if e.code == "ai_busy" else 502
        headers = {"Retry-After": str(int(e.retry_after))} if e.retry_after else None
        raise HTTPException(status_code=status_code, detail=e.public_message, headers=headers)
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
        sources=sources, reasoning_text=result.get("reasoning"), user_settings=user.settings,
    )
    background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

    return result
