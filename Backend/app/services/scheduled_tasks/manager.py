import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal, engine
from app.models.scheduled_task import ScheduledTask
from app.services.scheduled_tasks.runner import run_scheduled_task_sync

logger = logging.getLogger("ScheduledTaskManager")


def _build_jobstore():
    """SQLAlchemyJobStore on the app's own DB engine (app/database.py) --
    every worker process shares the same job definitions via the DB rather
    than each keeping its own separate in-memory copy, same intent as the
    RedisJobStore this replaced. Switched off Redis for the jobstore
    specifically because Upstash's free tier drops idle connections, which
    surfaced as intermittent scheduler errors; the DB engine already has
    pool_pre_ping=True for exactly that kind of drop. The scheduler run-
    lock (locking.py) is unchanged and still Redis-backed -- sharing a
    jobstore alone was never what stopped two workers from firing the same
    job at the same tick, so that part still needs Redis regardless of
    where the job definitions themselves live.

    Table creation is deferred to SQLAlchemyJobStore.start() (called via
    scheduler.start() in init_scheduler(), which runs after init_db() in
    app.main's lifespan) -- constructing the store here does not touch the
    database at all, so this can safely run at import time, before the
    app's own tables exist yet.
    """
    try:
        from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
        store = SQLAlchemyJobStore(engine=engine)
        logger.info("scheduler jobstore: sqlalchemy (%s)", engine.dialect.name)
        return store
    except Exception:
        logger.exception(
            "scheduler jobstore: in-process fallback (SQLAlchemyJobStore "
            "could not be built). This is NOT safe with more than one "
            "worker process."
        )
        return MemoryJobStore()


scheduler = BackgroundScheduler(jobstores={"default": _build_jobstore()})


def _job_id(task_id: str) -> str:
    return f"scheduled_task:{task_id}"


def schedule_task(task: ScheduledTask) -> None:
    try:
        trigger = CronTrigger.from_crontab(task.schedule, timezone=task.timezone)
    except Exception:
        logger.warning("Could not schedule task %s: invalid cron %r", task.id, task.schedule)
        return
    try:
        scheduler.add_job(
            run_scheduled_task_sync, trigger=trigger, id=_job_id(task.id), args=[task.id],
            replace_existing=True, misfire_grace_time=3600,
        )
    except Exception:
        # A Redis-backed jobstore can hit a transient connection error here
        # (see app/utils/redis_client.py) -- one task failing to (re-)arm
        # must not stop every task after it in init_scheduler()'s loop from
        # being scheduled too.
        logger.exception("Could not schedule task %s (jobstore error)", task.id)


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
