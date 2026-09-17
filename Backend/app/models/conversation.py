# app/models/conversation.py
from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String, default="New Conversation")
    model = Column(String, nullable=True)
    focus_mode = Column(String, nullable=True)
    web_search_enabled = Column(Boolean, default=False)
    pinned = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    favorite = Column(Boolean, default=False)
    workspace = Column(String, default="chat", index=True)
    messages = Column(JSON, default=[])
    # Nullable: most chats belong to no project. SET NULL (not CASCADE) so
    # deleting a project detaches its chats instead of deleting them.
    project_id = Column(String(36), ForeignKey("chat_projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="conversations")

    def to_dict(self):
        created = self.created_at.isoformat() if self.created_at else None
        updated = self.updated_at.isoformat() if self.updated_at else created
        return {
            "id": self.id,
            "title": self.title,
            "user_id": self.user_id,
            "workspace": self.workspace or "chat",
            # Never surface a real provider/model id, even if one somehow
            # ended up stored here (e.g. from an older row or a client-
            # supplied value at creation time).
            "model": "Vatsa AI" if self.model else None,
            "focus_mode": self.focus_mode,
            "web_search_enabled": self.web_search_enabled,
            "pinned": self.pinned or False,
            "archived": self.archived or False,
            "favorite": self.favorite or False,
            "project_id": self.project_id,
            "projectId": self.project_id,
            "messages": self.messages or [],
            "created_at": created,
            "updated_at": updated,
            "createdAt": created,
            "updatedAt": updated,
        }