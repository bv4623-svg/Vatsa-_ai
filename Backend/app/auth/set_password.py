import logging
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/set-password", tags=["auth"])

class SetPasswordRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str

@router.post("")
async def set_password(req: SetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # ✅ Correct async query
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user:
        user.hashed_password = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        await db.commit()
        logger.info(f"Password updated for {req.email}")
        return {"message": "Password updated successfully"}
    else:
        hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = User(
            email=req.email,
            hashed_password=hashed,
            is_verified=True,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow()
        )
        db.add(new_user)
        await db.commit()
        logger.info(f"New user created via set-password for {req.email}")
        return {"message": "User created and password set"}