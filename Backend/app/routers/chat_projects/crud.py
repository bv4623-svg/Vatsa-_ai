import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.chat_project import ChatProject
from app.auth.dependencies import get_current_user
from app.services.chat_projects import to_public_dict, detach_all
from app.routers.chat_projects.deps import get_owned_project
from app.routers.chat_projects.schemas import CreateProjectRequest, UpdateProjectRequest
from app.utils.cache import cache_get, cache_set, cache_delete_many

router = APIRouter()

_UPDATABLE_FIELDS = ("name", "description", "system_prompt", "instructions")
CACHE_TTL_SECONDS = 60


def _list_cache_key(user_id: int, archived: Optional[bool]) -> str:
    return f"projects:list:{user_id}:{archived}"


def _invalidate_project_list_cache(user_id: int) -> None:
    # One list endpoint, three possible `archived` values (None/True/False)
    # -- all three variants for this user must be dropped together, since
    # a write can't know in advance which of them it would have appeared in.
    cache_delete_many(_list_cache_key(user_id, v) for v in (None, True, False))


@router.post("/api/projects")
def create_project(payload: CreateProjectRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = ChatProject(
        id=uuid.uuid4().hex,
        user_id=user.id,
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        instructions=payload.instructions,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    _invalidate_project_list_cache(user.id)
    return to_public_dict(db, project)


@router.get("/api/projects")
def list_projects(
    archived: Optional[bool] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = _list_cache_key(user.id, archived)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    q = db.query(ChatProject).filter(ChatProject.user_id == user.id)
    if archived is not None:
        q = q.filter(ChatProject.archived == archived)
    projects = q.order_by(ChatProject.updated_at.desc()).all()
    result = {"items": [to_public_dict(db, p) for p in projects]}
    cache_set(cache_key, result, CACHE_TTL_SECONDS)
    return result


@router.get("/api/projects/{project_id}")
def get_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    return to_public_dict(db, project)


@router.patch("/api/projects/{project_id}")
def update_project(
    payload: UpdateProjectRequest, project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)
):
    for field in _UPDATABLE_FIELDS:
        value = getattr(payload, field)
        if value is not None:
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    _invalidate_project_list_cache(project.user_id)
    return to_public_dict(db, project)


@router.delete("/api/projects/{project_id}")
def delete_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    user_id = project.user_id
    detach_all(db, project)
    db.delete(project)
    db.commit()
    _invalidate_project_list_cache(user_id)
    return {"deleted": True}


@router.post("/api/projects/{project_id}/archive")
def archive_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    project.archived = True
    db.commit()
    db.refresh(project)
    _invalidate_project_list_cache(project.user_id)
    return to_public_dict(db, project)


@router.post("/api/projects/{project_id}/unarchive")
def unarchive_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    project.archived = False
    db.commit()
    db.refresh(project)
    _invalidate_project_list_cache(project.user_id)
    return to_public_dict(db, project)
