from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    state = Column(JSON, nullable=False)  # full files tree + content
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="snapshots")