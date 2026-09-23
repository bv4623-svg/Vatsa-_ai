from fastapi import BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.chat_projects import get_project_instructions_for_conversation
from app.utils.rate_limit import enforce_rate_limit

from app.routers.chat.schemas import ChatRequest
from app.routers.chat.helpers import _response_style_instruction, _load_history, _parse_attachments
from app.routers.chat.limits import _enforce_daily_limit
from app.routers.chat.search import _get_search_context
from app.routers.chat.streaming import _stream_chat_response
from app.routers.chat.image_generation import _handle_image_generation
from app.routers.chat.non_streaming import _handle_non_streaming
from app.routers.chat.router import router, CHAT_BURST_LIMIT, CHAT_BURST_WINDOW_SECONDS


@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    enforce_rate_limit(f"chat-burst:user:{user.id}", limit=CHAT_BURST_LIMIT, window_seconds=CHAT_BURST_WINDOW_SECONDS)

    user_settings = user.settings or {}
    chosen_model = req.model or req.preferred_model or user_settings.get("defaultModel") or "auto"
    workspace = req.workspace or "chat"
    response_style_instructions = _response_style_instruction(user_settings.get("responseStyle"))

    # --- 1. Image Generation Check (instant, single-shot -- never streamed;
    # the streaming frontend clients already fall back to plain JSON when
    # the response isn't text/event-stream, so this stays consistent even
    # when the caller asked for stream=true). ---
    img_response = await _handle_image_generation(req, user, db, background_tasks)
    if img_response is not None:
        return img_response

    # --- 2. Daily message-limit check (per workspace) ---
    _enforce_daily_limit(db, user, "code_messages" if workspace == "code" else "chat_messages")

    # --- 3. Load Conversation History + Attachments ---
    conv, history_messages = _load_history(req, user, db)
    parsed_attachments = _parse_attachments(req)
    search_context, sources = await _get_search_context(req, user, db)
    # A chat that belongs to a Project gets that project's systemPrompt +
    # instructions applied to every message, not just the ones sent while
    # viewing the project UI.
    project_instructions = get_project_instructions_for_conversation(db, conv)

    # --- 3. Streaming path ---
    if req.stream:
        return StreamingResponse(
            _stream_chat_response(
                req, user, db, conv, history_messages, parsed_attachments,
                chosen_model, workspace, background_tasks, search_context, sources,
                req.reasoning, project_instructions, response_style_instructions,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # --- 4. Non-streaming path (unchanged behavior, plus sources/reasoning when present) ---
    return await _handle_non_streaming(
        req, user, db, background_tasks, conv, history_messages, parsed_attachments,
        chosen_model, workspace, search_context, sources, project_instructions,
        response_style_instructions,
    )
