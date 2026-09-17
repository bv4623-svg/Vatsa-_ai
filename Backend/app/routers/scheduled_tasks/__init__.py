"""Scheduled Tasks API: create/list/update/pause/resume/delete/run-now,
backed by a real APScheduler job per active task. One APIRouter combining
the split submodules, mounted once from app.main the same way
app.routers.library's package is.
"""
from fastapi import APIRouter

from app.routers.scheduled_tasks.crud import router as crud_router
from app.routers.scheduled_tasks.mutate import router as mutate_router

router = APIRouter(tags=["scheduled-tasks"])
router.include_router(crud_router)
router.include_router(mutate_router)

__all__ = ["router"]
