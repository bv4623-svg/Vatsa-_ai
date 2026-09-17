from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.chat_project import ChatProject
from app.auth.dependencies import get_current_user
from app.services.chat_projects import add_chat, remove_chat, add_file, remove_file, to_public_dict
from app.routers.chat_projects.deps import get_owned_project
from app.routers.chat_projects.schemas import AddChatRequest, AddFileRequest

router = APIRouter()


@router.post("/api/projects/{project_id}/chats")
def add_project_chat(
    payload: AddChatRequest, project: ChatProject = Depends(get_owned_project),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    add_chat(db, project, user.id, payload.conversation_id)
    return to_public_dict(db, project)


@router.delete("/api/projects/{project_id}/chats/{conversation_id}")
def remove_project_chat(conversation_id: str, project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    remove_chat(db, project, conversation_id)
    return to_public_dict(db, project)


@router.post("/api/projects/{project_id}/files")
def add_project_file(
    payload: AddFileRequest, project: ChatProject = Depends(get_owned_project),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    add_file(db, project, user.id, payload.item_id)
    return to_public_dict(db, project)


@router.delete("/api/projects/{project_id}/files/{item_id}")
def remove_project_file(item_id: str, project: ChatProject = Depends(get_owned_project), db: Session = Depends(get_db)):
    remove_file(db, project, item_id)
    return to_public_dict(db, project)
