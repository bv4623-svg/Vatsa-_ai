import uuid

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.auth.dependencies import get_current_user
from app.routers.conversations.router import router


@router.post("/conversations/{conv_id}/duplicate")
def duplicate_conversation(conv_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    src = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Conversation not found")

    new_id = f"conv_{uuid.uuid4().hex[:12]}"
    new_conv = Conversation(
        id=new_id,
        user_id=current_user.id,
        title=f"{src.title} (copy)",
        workspace=src.workspace,
        model=src.model,
        messages=list(src.messages or []),
        pinned=False,
        favorite=False,
        archived=False
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv.to_dict()
