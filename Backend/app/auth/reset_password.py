from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import bcrypt

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP

router = APIRouter(prefix="/auth", tags=["auth"])

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str
    verification_token: str

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset user password after OTP verification
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify the OTP token is valid
    result = await db.execute(select(OTP).where(
        OTP.email == request.email,
        OTP.verification_token == request.verification_token,
        OTP.purpose == "reset",
        OTP.is_verified == True,
        OTP.expires_at > datetime.utcnow()
    ))
    otp_record = result.scalar_one_or_none()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    # Hash new password
    hashed_password = bcrypt.hashpw(
        request.new_password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')
    
    # Update user password
    user.hashed_password = hashed_password
    user.updated_at = datetime.utcnow()
    
    # Mark OTP as used
    otp_record.is_used = True
    
    await db.commit()
    
    return {
        "message": "Password reset successful",
        "status": "success"
    }