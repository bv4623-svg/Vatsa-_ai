from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.conversation import Conversation
from app.routers.chat.schemas import ChatRequest


def _response_style_instruction(style: Optional[str]) -> Optional[str]:
    """Maps the Settings > responseStyle preference to a real system-prompt
    addition -- prepended the same way project_instructions is, so the
    stored preference actually changes model output, not just sits in
    User.settings unused."""
    return {
        "concise": "Keep replies brief and to the point.",
        "detailed": "Provide thorough, comprehensive explanations with context and examples.",
        "friendly": "Use a warm, conversational, approachable tone.",
        "formal": "Use precise, professional language.",
    }.get(style)


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
