from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.memory_service import MemoryService

router = APIRouter(prefix="/api/memory", tags=["memory"])

class MemoryCreate(BaseModel):
    content: str
    type: Optional[str] = "preference"
    category: Optional[str] = None
    source: Optional[str] = "user"
    confidence: Optional[float] = 0.8
    expires_at: Optional[datetime] = None

class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    expires_at: Optional[datetime] = None

@router.get("")
@router.get("/")
def list_memories(
    type: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    memories = MemoryService.get_user_memories(db, current_user.id, mem_type=type, category=category)
    return [m.to_dict() for m in memories]

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_memory(
    req: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Memory content cannot be empty")
    mem = MemoryService.create_memory(
        db=db,
        user_id=current_user.id,
        content=req.content,
        mem_type=req.type or "preference",
        category=req.category,
        source=req.source or "user",
        confidence=req.confidence or 0.8,
        expires_at=req.expires_at
    )
    return mem.to_dict()

@router.put("/{memory_id}")
def update_memory(
    memory_id: int,
    req: MemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = MemoryService.update_memory(db, current_user.id, memory_id, req.model_dump(exclude_unset=True))
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    return mem.to_dict()

@router.delete("/{memory_id}")
def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = MemoryService.delete_memory(db, current_user.id, memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"success": True, "id": memory_id}

@router.delete("")
@router.delete("/")
def clear_memories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deleted_count = MemoryService.clear_all_memories(db, current_user.id)
    return {"success": True, "deleted": deleted_count}
