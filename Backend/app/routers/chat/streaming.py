import json
from typing import Optional, List, Dict, Any, AsyncGenerator

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.conversation import Conversation
from app.services.ai_service import AIService
from app.routers.chat.schemas import ChatRequest
from app.routers.chat.memory import _extract_and_save_memory
from app.routers.chat.persistence import _persist_conversation
from app.routers.chat.router import logger


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
    project_instructions: Optional[str] = None,
    response_style_instructions: Optional[str] = None,
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
            project_instructions=project_instructions,
            response_style_instructions=response_style_instructions,
        ):
            if "thinking" in event:
                yield f"data: {json.dumps({'thinking': event['thinking']})}\n\n"
            elif "delta" in event:
                yield f"data: {json.dumps({'delta': event['delta']})}\n\n"
            elif "error" in event:
                logger.warning(f"Stream error for user {user.id}: {event['error']}")
                payload = {"error": event["error"]}
                if event.get("retry_after"):
                    payload["retry_after"] = event["retry_after"]
                yield f"data: {json.dumps(payload)}\n\n"
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
        _persist_conversation(conv, db, req.message, full_text, "Vatsa AI", sources=sources, reasoning_text=reasoning_text, user_settings=user.settings)
        background_tasks.add_task(_extract_and_save_memory, user.id, req.message)

    done_event: Dict[str, Any] = {"done": True, "usage": usage, "conversation_id": req.conversation_id}
    if sources:
        done_event["sources"] = sources
    if reasoning_text:
        done_event["reasoning"] = reasoning_text
    yield f"data: {json.dumps(done_event)}\n\n"
