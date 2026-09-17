import asyncio
import logging
import uuid
from datetime import datetime, timezone as dt_timezone

from app.database import SessionLocal
from app.models.user import User
from app.models.conversation import Conversation
from app.models.scheduled_task import ScheduledTask
from app.services.ai_service import AIService
from app.services.scheduled_tasks.cron import compute_next_run
from app.utils.email import send_task_result_email

logger = logging.getLogger("ScheduledTaskRunner")


async def _run_task_async(task_id: str) -> None:
    db = SessionLocal()
    try:
        task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
        if not task or task.status != "active":
            return
        user = db.query(User).filter(User.id == task.user_id).first()
        if not user:
            return

        # Imported here rather than at module load: this module is reached
        # from app.services.scheduled_tasks, which app.main wires up before
        # every router including chat's is guaranteed to be fully loaded --
        # deferring the import avoids relying on that ordering.
        from app.routers.chat import _persist_conversation

        conv = Conversation(id=uuid.uuid4().hex, user_id=user.id, title=task.title, workspace="chat", messages=[])
        db.add(conv)
        db.commit()

        error_text = None
        try:
            result = await AIService.generate_response(
                db=db, user=user, query=task.prompt, conversation_history=[],
                model_name=task.model, workspace="chat",
            )
            _persist_conversation(conv, db, task.prompt, result["response"], result.get("selected_model", "Vatsa AI"))
        except Exception as e:
            error_text = str(e)
            logger.exception("Scheduled task %s failed", task_id)

        task.last_run_at = datetime.now(dt_timezone.utc)
        task.last_result_id = conv.id
        task.next_run_at = compute_next_run(task.schedule, task.timezone, after=task.last_run_at)
        db.commit()

        if task.notify_email:
            try:
                send_task_result_email(user.email, task.title, success=error_text is None, error=error_text)
            except Exception:
                logger.exception("Failed to send scheduled-task email for %s", task_id)
    finally:
        db.close()


def run_scheduled_task_sync(task_id: str) -> None:
    """Sync entry point for APScheduler's BackgroundScheduler and FastAPI's
    BackgroundTasks (run-now) -- both call plain sync functions, so this
    opens its own event loop for the one async call inside."""
    asyncio.run(_run_task_async(task_id))
