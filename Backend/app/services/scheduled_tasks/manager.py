import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models.scheduled_task import ScheduledTask
from app.services.scheduled_tasks.runner import run_scheduled_task_sync

logger = logging.getLogger("ScheduledTaskManager")
scheduler = BackgroundScheduler()


def _job_id(task_id: str) -> str:
    return f"scheduled_task:{task_id}"


def schedule_task(task: ScheduledTask) -> None:
    try:
        trigger = CronTrigger.from_crontab(task.schedule, timezone=task.timezone)
    except Exception:
        logger.warning("Could not schedule task %s: invalid cron %r", task.id, task.schedule)
        return
    scheduler.add_job(
        run_scheduled_task_sync, trigger=trigger, id=_job_id(task.id), args=[task.id],
        replace_existing=True, misfire_grace_time=3600,
    )


def unschedule_task(task_id: str) -> None:
    try:
        scheduler.remove_job(_job_id(task_id))
    except JobLookupError:
        pass


def init_scheduler() -> None:
    """Called once from app.main's lifespan startup. Loads every active
    task from the DB and re-arms its cron job -- APScheduler's in-memory
    job store doesn't survive a process restart on its own."""
    if not scheduler.running:
        scheduler.start()
    db = SessionLocal()
    try:
        tasks = db.query(ScheduledTask).filter(ScheduledTask.status == "active").all()
        for task in tasks:
            schedule_task(task)
    finally:
        db.close()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
