# app/api/conversations.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.oauth import get_current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])

# ---------- Request/Response Models ----------
class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    model: Optional[str] = None
    focus_mode: Optional[str] = None
    web_search_enabled: bool = False

class ConversationResponse(BaseModel):
    id: str
    title: str
    model: Optional[str]
    focus_mode: Optional[str]
    web_search_enabled: bool
    pinned: bool
    archived: bool
    favorite: bool
    messages: List[dict] = []
    created_at: Optional[str]
    updated_at: Optional[str]

class ConversationListResponse(BaseModel):
    success: bool
    data: List[ConversationResponse]

# ---------- GET all conversations ----------
@router.get("/", response_model=ConversationListResponse)
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversations for the authenticated user."""
    try:
        # Async query using select
        stmt = select(Conversation).where(Conversation.user_id == current_user.id).order_by(Conversation.updated_at.desc())
        result = await db.execute(stmt)
        conversations = result.scalars().all()

        return {
            "success": True,
            "data": [conv.to_dict() for conv in conversations]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- GET single conversation ----------
@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.to_dict()

# ---------- CREATE new conversation ----------
@router.post("/", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title=data.title or "New Conversation",
        model=data.model,
        focus_mode=data.focus_mode,
        web_search_enabled=data.web_search_enabled,
        pinned=False,
        archived=False,
        favorite=False,
        messages=[],
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return new_conv.to_dict()

# ---------- DELETE conversation ----------
@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return None

# ---------- UPDATE conversation (e.g., title, pinned, archived, favorite) ----------
class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None
    favorite: Optional[bool] = None
    messages: Optional[List[dict]] = None

@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Update fields if provided
    if data.title is not None:
        conv.title = data.title
    if data.pinned is not None:
        conv.pinned = data.pinned
    if data.archived is not None:
        conv.archived = data.archived
    if data.favorite is not None:
        conv.favorite = data.favorite
    if data.messages is not None:
        conv.messages = data.messages

    conv.updated_at = func.now()  # SQLAlchemy will handle onupdate
    await db.commit()
    await db.refresh(conv)
    return conv.to_dict()