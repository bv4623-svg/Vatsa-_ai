"""
app/models/chat.py – Chat and Message models for Vatsa AI
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# ────────────────────────────────────────────────────────────────
# Chat (conversation) model
# ────────────────────────────────────────────────────────────────
class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True, default="New Chat")
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ✅ फिक्स: back_populates हटाया – अब यह सिर्फ आगे की तरफ काम करेगा (chat.user)
    user = relationship("User")
    
    # यह रिलेशनशिप ठीक है – Message में back_populates="chat" मौजूद है
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

# ────────────────────────────────────────────────────────────────
# Message model
# ────────────────────────────────────────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)          # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    chat = relationship("Chat", back_populates="messages")