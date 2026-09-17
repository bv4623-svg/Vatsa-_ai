from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base


class ChatProject(Base):
    """A named container that groups chats + Library files under one
    system prompt/instructions. Named ChatProject (table chat_projects)
    to avoid colliding with the pre-existing, unrelated code-workspace
    Project model/table (app/models/project.py), which this feature does
    not touch.

    chatIds/fileIds are never stored here -- they're derived by querying
    Conversation.project_id / LibraryItem.project_id (see
    app.services.chat_projects.dicts.to_public_dict), the same
    real-data-not-duplicated approach the Library feature uses for
    storage totals.
    """
    __tablename__ = "chat_projects"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    archived = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "name": self.name,
            "description": self.description,
            "systemPrompt": self.system_prompt,
            "instructions": self.instructions,
            "archived": self.archived,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
