from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class File(Base):
    """
    Represents a file within a project. Stores content, metadata, and timestamps.
    Supports both text and binary files (via the `is_binary` flag).
    """
    __tablename__ = "files"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to project – database-level cascade ensures cleanup
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"),
                        nullable=False, index=True, comment="Parent project ID")

    # File identification
    path = Column(String(500), nullable=False, index=True,
                  comment="Full relative path inside the project (e.g., src/App.js)")
    filename = Column(String(255), nullable=True, index=True,
                      comment="Base filename (extracted from path for quick filtering)")

    # Content – nullable because binary files may not be stored as text
    content = Column(Text, nullable=True, comment="File content (text) or None for binary files")
    is_binary = Column(Boolean, default=False, nullable=False,
                       comment="True if the file is binary (content is not stored)")

    # Timestamps (timezone-aware, database‑side)
    created_at = Column(DateTime(timezone=True), server_default=func.now(),
                        nullable=False, comment="Creation timestamp")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False,
                        comment="Last modification timestamp")

    # Relationship back to Project (string name to avoid circular imports)
    project = relationship("Project", back_populates="files")

    # Additional indexes for common query patterns
    __table_args__ = (
        Index("idx_file_project_path", "project_id", "path"),
        Index("idx_file_project_filename", "project_id", "filename"),
    )

    def __repr__(self):
        return f"<File(id={self.id}, path={self.path}, project_id={self.project_id})>"