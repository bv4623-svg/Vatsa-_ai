from typing import List, Optional
from pydantic import BaseModel


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None


class UpdateItemRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    tags: Optional[List[str]] = None


class BulkIdsRequest(BaseModel):
    ids: List[str]


class BulkMoveRequest(BaseModel):
    ids: List[str]
    parent_id: Optional[str] = None
