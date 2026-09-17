from apscheduler.triggers.cron import CronTrigger

from app.services.scheduled_tasks.manager import scheduler
from app.services.account.retention import enforce_history_retention
from app.services.account.deletion import hard_delete_expired_accounts


def register_account_jobs() -> None:
    """Registers the two system-level daily jobs (history retention,
    hard-delete grace period) on the same APScheduler instance user
    ScheduledTasks already use -- one background scheduler for the whole
    process, not a second competing one."""
    scheduler.add_job(enforce_history_retention, CronTrigger(hour=3, minute=0), id="system:history_retention", replace_existing=True)
    scheduler.add_job(hard_delete_expired_accounts, CronTrigger(hour=3, minute=30), id="system:hard_delete_accounts", replace_existing=True)
