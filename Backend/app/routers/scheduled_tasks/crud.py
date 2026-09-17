import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.scheduled_task import ScheduledTask
from app.auth.dependencies import get_current_user
from app.services.scheduled_tasks import validate_cron, compute_next_run, schedule_task
from app.routers.scheduled_tasks.schemas import CreateTaskRequest

router = APIRouter()


@router.post("/api/scheduled-tasks")
def create_task(payload: CreateTaskRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not validate_cron(payload.schedule):
        raise HTTPException(status_code=400, detail="Invalid schedule expression")

    task = ScheduledTask(
        id=uuid.uuid4().hex,
        user_id=user.id,
        title=payload.title,
        prompt=payload.prompt,
        schedule=payload.schedule,
        timezone=payload.timezone or "UTC",
        model=payload.model,
        notify_email=payload.notify_email,
        status="active",
    )
    task.next_run_at = compute_next_run(task.schedule, task.timezone)
    db.add(task)
    db.commit()
    db.refresh(task)
    schedule_task(task)
    return task.to_dict()


@router.get("/api/scheduled-tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ScheduledTask).filter(ScheduledTask.user_id == user.id)
    total = q.count()
    tasks = (
        q.order_by(ScheduledTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [t.to_dict() for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": page * page_size < total,
    }
