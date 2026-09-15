from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ProjectCreate(BaseModel):
    chat_id: int
    title: Optional[str] = None
    framework: str = "react"

class FileUpdate(BaseModel):
    path: str
    content: str

class ProjectResponse(BaseModel):
    id: int
    chat_id: int
    title: Optional[str]
    framework: str
    status: str
    preview_url: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True