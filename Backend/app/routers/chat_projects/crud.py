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

router = APIRouter()

_UPDATABLE_FIELDS = ("name", "description", "system_prompt", "instructions")


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
    return to_public_dict(db, project)


@router.get("/api/projects")
def list_projects(
    archived: Optional[bool] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ChatProject).filter(ChatProject.user_id == user.id)
    if archived is not None:
        q = q.filter(ChatProject.archived == archived)
    projects = q.order_by(ChatProject.updated_at.desc()).all()
    return {"items": [to_public_dict(db, p) for p in projects]}


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
    return to_public_dict(db, project)


@router.delete("/api/projects/{project_id}")
def delete_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    detach_all(db, project)
    db.delete(project)
    db.commit()
    return {"deleted": True}


@router.post("/api/projects/{project_id}/archive")
def archive_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    project.archived = True
    db.commit()
    db.refresh(project)
    return to_public_dict(db, project)


@router.post("/api/projects/{project_id}/unarchive")
def unarchive_project(project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    project.archived = False
    db.commit()
    db.refresh(project)
    return to_public_dict(db, project)
