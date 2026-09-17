from datetime import datetime
from typing import Optional
from apscheduler.triggers.cron import CronTrigger


def validate_cron(expr: str) -> bool:
    try:
        CronTrigger.from_crontab(expr)
        return True
    except Exception:
        return False


def compute_next_run(expr: str, tz_name: str, after: Optional[datetime] = None) -> Optional[datetime]:
    """Real next-fire-time computation via APScheduler's own CronTrigger --
    never a hand-rolled cron parser."""
    try:
        trigger = CronTrigger.from_crontab(expr, timezone=tz_name)
    except Exception:
        return None
    now = after or datetime.now(trigger.timezone)
    return trigger.get_next_fire_time(None, now)
