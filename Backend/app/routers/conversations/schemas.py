from typing import Optional

from pydantic import BaseModel


class CreateConvRequest(BaseModel):
    title: Optional[str] = "New Chat"
    workspace: Optional[str] = "chat"
    model: Optional[str] = None


class UpdateConvRequest(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None
    favorite: Optional[bool] = None
    archived: Optional[bool] = None
