from collections import defaultdict
from typing import Dict, List

from sqlalchemy.orm import Session
from app.models.chat_project import ChatProject
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem


def to_public_dicts(db: Session, projects: List[ChatProject]) -> List[dict]:
    """chatIds/fileIds are computed from the real owning rows, never stored
    redundantly on the project itself. Two queries for any number of
    projects (one per project used to make the list endpoint N+1)."""
    ids = [p.id for p in projects]
    chats: Dict[str, List[str]] = defaultdict(list)
    files: Dict[str, List[str]] = defaultdict(list)
    if ids:
        for row in db.query(Conversation.id, Conversation.project_id).filter(Conversation.project_id.in_(ids)).all():
            chats[row.project_id].append(row.id)
        for row in db.query(LibraryItem.id, LibraryItem.project_id).filter(LibraryItem.project_id.in_(ids)).all():
            files[row.project_id].append(row.id)
    out = []
    for project in projects:
        data = project.to_dict()
        data["chatIds"] = chats.get(project.id, [])
        data["fileIds"] = files.get(project.id, [])
        out.append(data)
    return out


def to_public_dict(db: Session, project: ChatProject) -> dict:
    return to_public_dicts(db, [project])[0]
