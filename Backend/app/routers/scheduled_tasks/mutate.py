from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scheduled_task import ScheduledTask
from app.services.scheduled_tasks import (
    validate_cron,
    compute_next_run,
    schedule_task,
    unschedule_task,
    run_scheduled_task_sync,
)
from app.routers.scheduled_tasks.deps import get_owned_task
from app.routers.scheduled_tasks.schemas import UpdateTaskRequest

router = APIRouter()

_UPDATABLE_FIELDS = ("title", "prompt", "schedule", "timezone", "model")


@router.patch("/api/scheduled-tasks/{task_id}")
def update_task(
    task_id: str, payload: UpdateTaskRequest,
    task: ScheduledTask = Depends(get_owned_task), db: Session = Depends(get_db),
):
    if payload.schedule is not None and not validate_cron(payload.schedule):
        raise HTTPException(status_code=400, detail="Invalid schedule expression")

    for field in _UPDATABLE_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            setattr(task, field, value)
    if payload.notify_email is not None:
        task.notify_email = payload.notify_email

    task.next_run_at = compute_next_run(task.schedule, task.timezone)
    db.commit()
    db.refresh(task)
    if task.status == "active":
        schedule_task(task)
    return task.to_dict()


@router.delete("/api/scheduled-tasks/{task_id}")
def delete_task(task_id: str, task: ScheduledTask = Depends(get_owned_task), db: Session = Depends(get_db)):
    unschedule_task(task.id)
    db.delete(task)
    db.commit()
    return {"deleted": True}


@router.post("/api/scheduled-tasks/{task_id}/pause")
def pause_task(task_id: str, task: ScheduledTask = Depends(get_owned_task), db: Session = Depends(get_db)):
    task.status = "paused"
    db.commit()
    unschedule_task(task.id)
    return task.to_dict()


@router.post("/api/scheduled-tasks/{task_id}/resume")
def resume_task(task_id: str, task: ScheduledTask = Depends(get_owned_task), db: Session = Depends(get_db)):
    task.status = "active"
    task.next_run_at = compute_next_run(task.schedule, task.timezone)
    db.commit()
    db.refresh(task)
    schedule_task(task)
    return task.to_dict()


@router.post("/api/scheduled-tasks/{task_id}/run-now")
def run_task_now(task_id: str, background_tasks: BackgroundTasks, task: ScheduledTask = Depends(get_owned_task)):
    background_tasks.add_task(run_scheduled_task_sync, task.id)
    return {"status": "running"}
