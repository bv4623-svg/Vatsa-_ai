from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["profile"])
auth_router = APIRouter(prefix="/auth", tags=["auth"])

class UserProfile(BaseModel):
    id: int
    email: str
    name: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    tier: str
    is_active: bool
    is_verified: bool
    profile_completed: bool
    settings: dict = {}
    created_at: Optional[str] = None

@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.full_name or current_user.username or current_user.email.split("@")[0],
        full_name=current_user.full_name,
        username=current_user.username,
        tier=current_user.tier or "free",
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        profile_completed=current_user.profile_completed,
        settings=current_user.settings or {},
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )

@auth_router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.full_name or current_user.username or current_user.email.split("@")[0],
        full_name=current_user.full_name,
        username=current_user.username,
        tier=current_user.tier or "free",
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        profile_completed=current_user.profile_completed,
        settings=current_user.settings or {},
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )

@auth_router.post("/onboarding")
async def complete_onboarding(
    birth_month: int,
    birth_year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.birth_month = birth_month
    current_user.birth_year = birth_year
    current_user.profile_completed = True
    db.commit()
    db.refresh(current_user)
    return {"success": True, "user": current_user.to_dict()}
