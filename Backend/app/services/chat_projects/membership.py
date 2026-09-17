from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.chat_project import ChatProject
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem


def add_chat(db: Session, project: ChatProject, user_id: int, conversation_id: str) -> None:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Chat not found")
    conv.project_id = project.id
    db.commit()


def remove_chat(db: Session, project: ChatProject, conversation_id: str) -> None:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.project_id == project.id).first()
    if conv:
        conv.project_id = None
        db.commit()


def add_file(db: Session, project: ChatProject, user_id: int, item_id: str) -> None:
    item = db.query(LibraryItem).filter(LibraryItem.id == item_id, LibraryItem.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="File not found")
    item.project_id = project.id
    db.commit()


def remove_file(db: Session, project: ChatProject, item_id: str) -> None:
    item = db.query(LibraryItem).filter(LibraryItem.id == item_id, LibraryItem.project_id == project.id).first()
    if item:
        item.project_id = None
        db.commit()


def detach_all(db: Session, project: ChatProject) -> None:
    """Manual cascade for project deletion.

    This app's SQLite connection runs without PRAGMA foreign_keys=ON, so
    project_id's ondelete="SET NULL" is declared on the model but never
    actually enforced by the database. Without this, deleting a project
    would leave conversations/library items pointing at a project id that
    no longer exists, instead of cleanly detaching them.
    """
    db.query(Conversation).filter(Conversation.project_id == project.id).update({"project_id": None})
    db.query(LibraryItem).filter(LibraryItem.project_id == project.id).update({"project_id": None})
    db.commit()
