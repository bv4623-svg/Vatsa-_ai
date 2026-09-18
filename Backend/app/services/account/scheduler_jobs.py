from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services.scheduled_tasks.manager import scheduler
from app.services.account.retention import enforce_history_retention
from app.services.account.deletion import hard_delete_expired_accounts
from app.services.subscription_expiry import expire_subscriptions


def register_account_jobs() -> None:
    """Registers the system-level jobs (history retention, hard-delete
    grace period, paid-access expiry) on the same APScheduler instance user
    ScheduledTasks already use -- one background scheduler for the whole
    process, not a second competing one."""
    scheduler.add_job(enforce_history_retention, CronTrigger(hour=3, minute=0), id="system:history_retention", replace_existing=True)
    scheduler.add_job(hard_delete_expired_accounts, CronTrigger(hour=3, minute=30), id="system:hard_delete_accounts", replace_existing=True)
    scheduler.add_job(expire_subscriptions, IntervalTrigger(hours=1), id="system:expire_subscriptions", replace_existing=True)
    # Also once at startup, so a server that was down across a plan's
    # expiry catches up immediately instead of waiting out the hour.
    expire_subscriptions()
