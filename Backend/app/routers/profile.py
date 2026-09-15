from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["profile"])
auth_router = APIRouter(prefix="/auth", tags=["auth"])

class UserProfile(BaseModel):
    id: int
    email: str
    name: str

@router.get("/profile")
async def get_profile():
    return UserProfile(id=1, email="default@vatsa.ai", name="Dev User")

@auth_router.get("/me")
async def get_me():
    return UserProfile(id=1, email="default@vatsa.ai", name="Dev User")
