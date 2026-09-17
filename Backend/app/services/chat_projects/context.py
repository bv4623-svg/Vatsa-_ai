from typing import Optional
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.chat_project import ChatProject


def get_project_instructions_for_conversation(db: Session, conv: Optional[Conversation]) -> Optional[str]:
    """The one hook chat.py calls so every message sent from a chat that
    belongs to a project gets that project's systemPrompt+instructions
    applied -- a real per-conversation lookup, never a client-supplied
    value."""
    if not conv or not conv.project_id:
        return None
    project = db.query(ChatProject).filter(ChatProject.id == conv.project_id).first()
    if not project:
        return None
    parts = [p for p in (project.system_prompt, project.instructions) if p and p.strip()]
    return "\n\n".join(parts) if parts else None
