from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class BuildLog(Base):
    __tablename__ = "build_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    log = Column(Text, nullable=False)
    level = Column(String(20), default="info")  # info, error, warn
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="build_logs")