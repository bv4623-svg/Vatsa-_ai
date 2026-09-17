from sqlalchemy.orm import Session
from app.models.chat_project import ChatProject
from app.models.conversation import Conversation
from app.models.library_item import LibraryItem


def to_public_dict(db: Session, project: ChatProject) -> dict:
    """chatIds/fileIds are computed here from the real owning rows, never
    stored redundantly on the project itself."""
    chat_ids = [row.id for row in db.query(Conversation.id).filter(Conversation.project_id == project.id).all()]
    file_ids = [row.id for row in db.query(LibraryItem.id).filter(LibraryItem.project_id == project.id).all()]
    data = project.to_dict()
    data["chatIds"] = chat_ids
    data["fileIds"] = file_ids
    return data
