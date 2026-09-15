"""
app/schemas/chat.py – Pydantic schemas for chat and AI interactions.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, ConfigDict


# =============================================================================
#  Message Schemas
# =============================================================================

class MessageBase(BaseModel):
    role: str
    content: str


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
#  Chat Schemas (CRUD)
# =============================================================================

class ChatBase(BaseModel):
    title: Optional[str] = "New Chat"


class ChatCreate(ChatBase):
    pass


class ChatResponse(ChatBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = []

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
#  AI Chat Request (used in /chat and /chat/stream)
# =============================================================================

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    conversation_id: Optional[str] = None
    workspace: str = "personal"
    model: str = "auto"
    user_id: Optional[str] = None
    user_tier: str = "free"
    session: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")


# =============================================================================
#  AI Chat Response (non‑streaming)
# =============================================================================

class Source(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    content: Optional[str] = None


class Followup(BaseModel):
    text: str
    action: Optional[str] = None


class AIChatResponse(BaseModel):
    response: str
    model: str = "vatsa‑ai"
    provider: str = "vatsa"
    sources: List[Source] = []
    followups: List[Followup] = []
    cost: float = 0.0
    latency: float = 0.0
    usage: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
#  Project / File schemas (used in /send and project endpoints)
# =============================================================================

class FileInfo(BaseModel):
    id: int
    path: str
    content: str


class ChatResponseWithProject(BaseModel):
    response: str
    project_id: Optional[int] = None
    files: Optional[List[FileInfo]] = None
    selected_model: Optional[str] = None


class GenerateProjectRequest(BaseModel):
    prompt: str
    chat_id: int
    framework: str = "react"
    title: Optional[str] = None


class CreateProjectFromChatRequest(BaseModel):
    chat_id: int
    framework: str = "react"
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    message: str
    chat_id: Optional[int] = None
    create_project: bool = False


# =============================================================================
#  Export all public classes
# =============================================================================

__all__ = [
    "MessageBase",
    "MessageCreate",
    "MessageResponse",
    "ChatBase",
    "ChatCreate",
    "ChatResponse",
    "ChatRequest",
    "Source",
    "Followup",
    "AIChatResponse",
    "FileInfo",
    "ChatResponseWithProject",
    "GenerateProjectRequest",
    "CreateProjectFromChatRequest",
    "SendMessageRequest",
]