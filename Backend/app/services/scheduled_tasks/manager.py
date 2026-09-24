import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models.scheduled_task import ScheduledTask
from app.services.scheduled_tasks.runner import run_scheduled_task_sync

logger = logging.getLogger("ScheduledTaskManager")


def _build_jobstore():
    """MemoryJobStore (APScheduler's own default) unless REDIS_URL is set
    and reachable, in which case every worker process shares the same job
    definitions instead of each keeping its own separate copy -- same
    fallback shape as app/utils/rate_limit.py and app/utils/cache.py.
    Sharing the job store alone does not stop two workers from both firing
    the same job at the same tick; locking.py's run-lock is what actually
    prevents a double execution."""
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    if not redis_url:
        logger.info("scheduler jobstore: in-process (single worker; REDIS_URL not set)")
        return MemoryJobStore()
    try:
        from apscheduler.jobstores.redis import RedisJobStore
        from app.utils.redis_client import get_redis_client

        # RedisJobStore builds its own internal connection from host/port/db/
        # password kwargs rather than accepting a pre-built client object, so
        # it can't literally reuse the shared client -- but going through
        # get_redis_client() first means the connect+ping probe (and its
        # retry loop) only ever happens once at startup, not once per module.
        conn = get_redis_client()
        if conn is None:
            raise ConnectionError("shared Redis client unavailable")
        store = RedisJobStore(
            host=conn.connection_pool.connection_kwargs.get("host", "localhost"),
            port=conn.connection_pool.connection_kwargs.get("port", 6379),
            db=conn.connection_pool.connection_kwargs.get("db", 0),
            password=conn.connection_pool.connection_kwargs.get("password"),
            socket_keepalive=True,
            health_check_interval=30,
        )
        logger.info("scheduler jobstore: redis")
        return store
    except Exception:
        logger.exception(
            "scheduler jobstore: in-process fallback (REDIS_URL is set but "
            "Redis could not be reached, or the `redis` package is not "
            "installed). This is NOT safe with more than one worker process."
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
