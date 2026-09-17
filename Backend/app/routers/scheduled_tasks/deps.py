from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scheduled_task import ScheduledTask
from app.models.user import User
from app.auth.dependencies import get_current_user


def get_owned_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ScheduledTask:
    """Same 404 whether the task doesn't exist or belongs to someone else
    -- never confirms another user's task id exists."""
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
    if not task or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
