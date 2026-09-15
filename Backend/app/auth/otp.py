# app/auth/otp_router.py – OTP authentication endpoints (ready to paste)
# Uses the new OTP model with code_hash, attempts, resend_count, etc.
# All helpers (create_access_token, decode_access_token, is_disposable_email) are imported from app.auth.oauth

import os
import random
import secrets
import string
import logging
import bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP
from app.auth.oauth import create_access_token, decode_access_token, is_disposable_email

# ----- Mail Config -----
def get_mail_config():
    username = os.getenv("EMAIL_USERNAME", "dummy@example.com")
    password = os.getenv("EMAIL_PASSWORD", "dummy_password")
    return ConnectionConfig(
        MAIL_USERNAME=username,
        MAIL_PASSWORD=password,
        MAIL_FROM=username,
        MAIL_PORT=int(os.getenv("EMAIL_SMTP_PORT", 587)),
        MAIL_SERVER=os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com"),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
    )

conf = get_mail_config()
router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# ─── Schemas ───
class SendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str  # "signup", "login", "reset"

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    # No verification_token needed; tokens are JWT-based

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=8)
    verification_token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str = Field(..., min_length=8)

class OnboardingRequest(BaseModel):
    birth_month: int = Field(..., ge=1, le=12)
    birth_year: int = Field(..., ge=1950, le=datetime.utcnow().year)

# ─── Helper: Get current user from token ───
async def get_current_user_from_token(request: Request, db: AsyncSession) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ─── Send OTP Email ───
async def send_otp_email(email: str, otp: str, purpose: str):
    print(f"📧 OTP for {email} ({purpose}): {otp}")   # console fallback
    try:
        if purpose == "reset":
            subject = "Vatsa AI - Password Reset OTP"
            body = f"Your password reset OTP is: {otp}\n\nIt expires in 5 minutes.\nIf you didn't request this, please ignore this email."
        else:
            subject = f"Vatsa AI - {'Verify your email' if purpose == 'signup' else 'Login OTP'}"
            body = f"Your OTP is: {otp}\n\nIt expires in 5 minutes."
        
        message = MessageSchema(subject=subject, recipients=[email], body=body, subtype="plain")
        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        print(f"⚠️ Email send failed: {e}")

# ─── 1. Send OTP ───
@router.post("/otp/send")
async def send_otp(
    req: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Send OTP for signup, login, or password reset.
    For reset, returns generic success to avoid email enumeration.
    """
    if req.purpose not in ["signup", "login", "reset"]:
        raise HTTPException(status_code=400, detail="Invalid purpose")

    # Check user existence
    user_result = await db.execute(select(User).where(User.email == req.email))
    user = user_result.scalar_one_or_none()

    if req.purpose == "signup" and user:
        raise HTTPException(status_code=409, detail="Email already registered. Please login.")
    if req.purpose == "login" and not user:
        raise HTTPException(status_code=404, detail="Email not registered. Please sign up.")
    if req.purpose == "reset" and not user:
        # Generic success – do not reveal if user exists
        return {"message": "If an account exists, an OTP has been sent."}

    # Delete old active OTPs for this email
    await db.execute(delete(OTP).where(OTP.email == req.email, OTP.is_used == False))

    # Generate 6‑digit OTP and hash it
    otp_code = ''.join(random.choices(string.digits, k=6))
    hashed = bcrypt.hashpw(otp_code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    new_otp = OTP(
        email=req.email,
        code_hash=hashed,
        purpose=req.purpose,
        expires_at=expires_at,
        attempts=0,
        resend_count=0,
        is_verified=False,
        is_used=False
    )
    db.add(new_otp)
    await db.commit()

    background_tasks.add_task(send_otp_email, req.email, otp_code, req.purpose)
    return {"message": "OTP sent successfully"}

# ─── 2. Resend OTP ───
@router.post("/otp/resend")
async def resend_otp(
    req: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Resend OTP for an existing active OTP record.
    Applies cooldown (60s) and max resend limit (3).
    """
    result = await db.execute(
        select(OTP).where(
            OTP.email == req.email,
            OTP.is_used == False,
            OTP.expires_at > datetime.utcnow()
        )
    )
    otp_entry = result.scalar_one_or_none()
    if not otp_entry:
        raise HTTPException(status_code=400, detail="No active OTP to resend. Please request a new one.")

    # Cooldown: at least 60 seconds since creation
    if (datetime.utcnow() - otp_entry.created_at).total_seconds() < 60:
        raise HTTPException(status_code=400, detail="Please wait 60 seconds before resending.")

    # Max resends: 3
    if otp_entry.resend_count >= 3:
        raise HTTPException(status_code=400, detail="Maximum resend attempts reached. Request a new OTP.")

    # Generate new OTP and hash
    new_otp_code = ''.join(random.choices(string.digits, k=6))
    hashed = bcrypt.hashpw(new_otp_code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Update existing record
    otp_entry.code_hash = hashed
    otp_entry.expires_at = datetime.utcnow() + timedelta(minutes=5)
    otp_entry.resend_count += 1
    otp_entry.attempts = 0  # reset attempts
    await db.commit()

    background_tasks.add_task(send_otp_email, req.email, new_otp_code, req.purpose)
    return {"message": "OTP resent successfully"}

# ─── 3. Verify OTP ───
@router.post("/otp/verify")
async def verify_otp(
    req: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP for signup, login, or password reset.
    Returns JWT tokens appropriate for the purpose.
    """
    # Find active OTP for this email
    result = await db.execute(
        select(OTP).where(
            OTP.email == req.email,
            OTP.is_used == False,
            OTP.expires_at > datetime.utcnow()
        ).order_by(OTP.created_at.desc())
    )
    otp_entry = result.scalar_one_or_none()

    if not otp_entry:
        raise HTTPException(status_code=400, detail="No active OTP found. Please request a new one.")

    # Check attempts limit (max 5)
    if otp_entry.attempts >= 5:
        otp_entry.is_used = True  # block further attempts
        await db.commit()
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new OTP.")

    # Verify OTP using bcrypt
    if not bcrypt.checkpw(req.otp.encode('utf-8'), otp_entry.code_hash.encode('utf-8')):
        otp_entry.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Mark as verified and used
    otp_entry.is_verified = True
    otp_entry.is_used = True
    await db.commit()

    # Handle different purposes
    if otp_entry.purpose == "reset":
        reset_token = create_access_token(
            {"sub": req.email, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=10)
        )
        return {"verified": True, "reset_token": reset_token}

    elif otp_entry.purpose == "login":
        user_result = await db.execute(select(User).where(User.email == req.email))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.last_login = datetime.utcnow()
        await db.commit()
        access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "profile_completed": user.profile_completed
            }
        }

    else:  # signup
        ver_token = create_access_token(
            {"email": req.email, "purpose": "registration"},
            expires_delta=timedelta(minutes=10)
        )
        return {"verified": True, "verification_token": ver_token}

# ─── 4. Register (after OTP verification) ───
@router.post("/register")
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        payload = decode_access_token(req.verification_token)
        if payload.get("purpose") != "registration":
            raise HTTPException(status_code=400, detail="Invalid token purpose")
        email = payload.get("email")
        if email != req.email:
            raise HTTPException(status_code=400, detail="Email mismatch")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        email=req.email,
        full_name=req.full_name,
        hashed_password=hashed,
        is_verified=True,
        created_at=datetime.utcnow(),
        last_login=datetime.utcnow(),
        profile_completed=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "profile_completed": user.profile_completed
        }
    }

# ─── 5. Login with password ───
@router.post("/login")
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="Use Google login")
    if not bcrypt.checkpw(req.password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Incorrect password")

    user.last_login = datetime.utcnow()
    await db.commit()

    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "profile_completed": user.profile_completed
        }
    }

# ─── 6. Reset Password (with reset_token) ───
@router.post("/password/reset")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        payload = decode_access_token(req.reset_token)
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        token_email = payload.get("sub")
        if token_email != req.email:
            raise HTTPException(status_code=400, detail="Email mismatch")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    hashed = bcrypt.hashpw(req.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user.hashed_password = hashed
    await db.commit()
    return {"message": "Password reset successfully"}

# ─── 7. Get current user ───
@router.get("/me")
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user_from_token(request, db)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "profile_completed": user.profile_completed,
    }

# ─── 8. Settings (get & update) ───
@router.get("/settings")
async def get_user_settings(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user_from_token(request, db)
    return user.settings or {}

@router.put("/settings")
async def update_user_settings(request: Request, req: dict, db: AsyncSession = Depends(get_db)):
    user = await get_current_user_from_token(request, db)
    current = user.settings or {}
    current.update(req)
    user.settings = current
    await db.commit()
    await db.refresh(user)
    return user.settings

# ─── 9. Onboarding ───
@router.get("/onboarding")
async def get_onboarding_status(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user_from_token(request, db)
    return {
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month,
        "birth_year": user.birth_year,
    }

@router.post("/onboarding")
async def complete_onboarding(
    req: OnboardingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user_from_token(request, db)
    if user.profile_completed:
        raise HTTPException(status_code=400, detail="Onboarding already completed")
    user.birth_month = req.birth_month
    user.birth_year = req.birth_year
    user.profile_completed = True
    await db.commit()
    await db.refresh(user)
    return {"message": "Onboarding completed"}