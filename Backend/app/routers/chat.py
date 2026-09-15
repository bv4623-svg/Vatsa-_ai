from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import uuid

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.services.ai_service import AIService, detect_image_gen, generate_image

router = APIRouter(prefix="/api", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = Field(None, alias="userId")
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    preferred_model: Optional[str] = Field(None, alias="preferredModel")
    workspace: Optional[str] = "chat"
    user_tier: Optional[str] = Field("free", alias="userTier")
    attachments: Optional[List[Union[str, Dict[str, Any]]]] = None
    stream: Optional[bool] = False
    model_config = {"populate_by_name": True}

@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    current_user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Resolve authenticated user or fallback
    user = current_user_opt
    if not user and req.user_id:
        user = db.query(User).filter(
            (User.email == req.user_id) | (User.id == req.user_id)
        ).first()

    if not user:
        # Fallback to dev/guest user
        user = db.query(User).first()
        if not user:
            user = User(
                email="guest@vatsa.ai",
                full_name="Guest User",
                is_active=True,
                is_verified=True,
                profile_completed=True,
                tier="free"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

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

        return {
            "status": "success",
            "query": req.message,
            "response": response_text,
            "selected_model": f"image:{img_data['model']}",
            "provider": "pollinations",
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
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

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

    return result

# Non-streaming send endpoint (used by chat.ts service)
@router.post("/chat/send")
async def send_message_endpoint(
    req: ChatRequest,
    current_user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    # Same logic as chat_endpoint but without streaming
    req.stream = False
    return await chat_endpoint(req, current_user_opt, db)
