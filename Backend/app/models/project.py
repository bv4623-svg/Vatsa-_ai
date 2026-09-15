from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Project(Base):
    """
    Represents a user's project, linked to a chat session and optionally to a user.
    Stores build status, preview URL, and associated files/logs/snapshots.
    """
    __tablename__ = "projects"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys (indexed for performance)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                     nullable=True, index=True, comment="Owner of the project")
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"),
                     nullable=False, index=True, comment="Associated chat session")

    # Additional identifier (from second model)
    conversation_id = Column(String, index=True, nullable=True,
                             comment="External conversation ID (e.g., from messaging platform)")

    # Project metadata
    title = Column(String(255), nullable=True, default="Untitled Project")
    workspace = Column(String(50), default="code", comment="Workspace type (code, design, etc.)")
    framework = Column(String(50), default="react", comment="Frontend framework used")
    status = Column(String(20), default="idle", index=True,
                    comment="Build status: idle, building, running, error")
    preview_url = Column(String(500), nullable=True, comment="URL to live preview")

    # Soft delete flag
    is_deleted = Column(Boolean, default=False, index=True, comment="Soft delete marker")

    # Timestamps (timezone-aware, set by the database)
    created_at = Column(DateTime(timezone=True), server_default=func.now(),
                        nullable=False, comment="Creation timestamp")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False,
                        comment="Last update timestamp")

    # Relationships – using string class names to avoid import cycles.
    # Cascade deletes: when a project is deleted, its files, logs, and snapshots are removed.
    files = relationship("File", back_populates="project",
                         cascade="all, delete-orphan", passive_deletes=True)
    build_logs = relationship("BuildLog", back_populates="project",
                              cascade="all, delete-orphan", passive_deletes=True)
    snapshots = relationship("Snapshot", back_populates="project",
                             cascade="all, delete-orphan", passive_deletes=True)

    # ✅ New relationship with UserMemory
    memories = relationship("UserMemory", back_populates="project", cascade="all, delete-orphan")

    # Optional: composite indexes for common query patterns
    __table_args__ = (
        Index("idx_project_user_status", "user_id", "status"),
        Index("idx_project_chat_deleted", "chat_id", "is_deleted"),
    )

    def __repr__(self):
        return f"<Project(id={self.id}, title={self.title}, status={self.status})>"