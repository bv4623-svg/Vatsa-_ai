from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base


class LibraryItem(Base):
    """
    One row per real, byte-accounted thing a user owns: a chat, a code
    workspace conversation, an uploaded file, an AI-generated image, or a
    folder grouping them. Storage usage is never estimated -- it is always
    SUM(size_bytes) over this table for the user.

    Chat/code rows are kept in sync with their Conversation by
    app.services.library.items.sync_conversation_item (called from the one
    place chat.py persists a finished exchange), so size_bytes always
    reflects the real serialized message JSON, not a stale snapshot.
    """
    __tablename__ = "library_items"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # "chat" | "document" | "code" | "artifact" | "upload" | "generated"
    type = Column(String(20), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    mime = Column(String(120), nullable=True)

    parent_id = Column(String(36), ForeignKey("library_items.id", ondelete="CASCADE"), nullable=True, index=True)
    is_folder = Column(Boolean, nullable=False, default=False)
    tags = Column(JSON, nullable=False, default=list)

    # Links back to the row that actually owns the bytes, so a preview or
    # download can fetch the real content instead of duplicating it here.
    source_table = Column(String(40), nullable=True)
    source_id = Column(String(64), nullable=True, index=True)
    # Only set for items with a real file on disk (uploads, generated
    # images) that can be downloaded or served directly.
    storage_path = Column(String(500), nullable=True)

    share_token = Column(String(43), nullable=True, unique=True, index=True)

    # A file can be attached to at most one project, independent of its
    # normal folder placement (parent_id above) -- SET NULL so deleting a
    # project detaches its files instead of deleting them.
    project_id = Column(String(36), ForeignKey("chat_projects.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "type": self.type,
            "name": self.name,
            "sizeBytes": self.size_bytes,
            "mime": self.mime,
            "parentId": self.parent_id,
            "isFolder": self.is_folder,
            "tags": self.tags or [],
            "sourceTable": self.source_table,
            "sourceId": self.source_id,
            "hasFile": bool(self.storage_path),
            "shared": bool(self.share_token),
            "projectId": self.project_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
