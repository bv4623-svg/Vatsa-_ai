from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat_project import ChatProject
from app.models.user import User
from app.auth.dependencies import get_current_user


def get_owned_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ChatProject:
    """Same 404 whether the project doesn't exist or belongs to someone
    else -- never confirms another user's project id exists."""
    project = db.query(ChatProject).filter(ChatProject.id == project_id).first()
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
