from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from typing import List, Optional
from pydantic import BaseModel
import datetime

from app.database import get_db
from app.models.memory import UserMemory, MemoryType
from app.auth.oauth import get_current_user   # <-- use existing dependency
from app.models.user import User

router = APIRouter(prefix="/api/memory", tags=["memory"])

# ---- Pydantic Schemas ----
class MemoryCreate(BaseModel):
    type: MemoryType
    category: Optional[str] = None
    content: str
    source: Optional[str] = None
    confidence: float = 0.8
    project_id: Optional[int] = None
    expires_at: Optional[datetime.datetime] = None

class MemoryUpdate(BaseModel):
    type: Optional[MemoryType] = None
    category: Optional[str] = None
    content: Optional[str] = None
    confidence: Optional[float] = None
    expires_at: Optional[datetime.datetime] = None

class MemoryResponse(BaseModel):
    id: int
    type: MemoryType
    category: Optional[str]
    content: str
    source: Optional[str]
    confidence: float
    project_id: Optional[int]
    expires_at: Optional[datetime.datetime]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

# ---- Endpoints ----
@router.get("/", response_model=List[MemoryResponse])
async def get_memories(
    current_user: User = Depends(get_current_user),   # <-- real user from auth
    type: Optional[MemoryType] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    query = select(UserMemory).where(UserMemory.user_id == user_id)
    if type:
        query = query.where(UserMemory.type == type)
    if category:
        query = query.where(UserMemory.category == category)
    query = query.where((UserMemory.expires_at.is_(None)) | (UserMemory.expires_at > datetime.datetime.utcnow()))
    result = await db.execute(query.order_by(UserMemory.created_at.desc()))
    return result.scalars().all()

@router.post("/", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    memory: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    db_memory = UserMemory(**memory.model_dump(), user_id=user_id)
    db.add(db_memory)
    await db.commit()
    await db.refresh(db_memory)
    return db_memory

@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    update_data: MemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    result = await db.execute(select(UserMemory).where(
        UserMemory.id == memory_id,
        UserMemory.user_id == user_id
    ))
    db_memory = result.scalar_one_or_none()
    if not db_memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(db_memory, key, value)
    await db.commit()
    await db.refresh(db_memory)
    return db_memory

@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    result = await db.execute(select(UserMemory).where(
        UserMemory.id == memory_id,
        UserMemory.user_id == user_id
    ))
    db_memory = result.scalar_one_or_none()
    if not db_memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    await db.delete(db_memory)
    await db.commit()

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id
    await db.execute(delete(UserMemory).where(UserMemory.user_id == user_id))
    await db.commit()