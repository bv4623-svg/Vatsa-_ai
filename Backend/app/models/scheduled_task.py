from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base


class ScheduledTask(Base):
    """A saved prompt that runs automatically on a cron schedule, in the
    user's own timezone. Each run calls the same AIService.generate_response
    a normal chat message uses and persists the result as a Conversation
    (see app.services.scheduled_tasks.runner), so a scheduled task's output
    shows up exactly like something the user typed themselves would --
    including auto-registering in the Library.
    """
    __tablename__ = "scheduled_tasks"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    prompt = Column(Text, nullable=False)
    schedule = Column(String(100), nullable=False)  # 5-field cron expression
    timezone = Column(String(64), nullable=False, default="UTC")
    model = Column(String(100), nullable=True)
    notify_email = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="active", index=True)  # active | paused

    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    last_result_id = Column(String(36), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "title": self.title,
            "prompt": self.prompt,
            "schedule": self.schedule,
            "timezone": self.timezone,
            "model": self.model,
            "notifyEmail": self.notify_email,
            "status": self.status,
            "lastRunAt": self.last_run_at.isoformat() if self.last_run_at else None,
            "nextRunAt": self.next_run_at.isoformat() if self.next_run_at else None,
            "lastResultId": self.last_result_id,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
