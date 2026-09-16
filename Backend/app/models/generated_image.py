from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class GeneratedImage(Base):
    """
    One AI-generated image, stored on disk under generated_images/{user_id}/
    after server-side watermark removal. The raw provider URL is never
    persisted or returned to a client -- only this row's id, served via
    /api/files/{id}/preview.
    """
    __tablename__ = "generated_images"

    id = Column(String(32), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False, comment="Path relative to the generated_images storage root")
    prompt = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
