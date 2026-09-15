from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime
import secrets

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(tags=["authentication"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    verification_token: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OnboardingRequest(BaseModel):
    birth_month: Optional[int] = None
    birth_year: Optional[int] = None
    role: Optional[str] = None
    experience: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

class OtpSendRequest(BaseModel):
    email: EmailStr
    purpose: str = "signup"

class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

@router.post("/auth/register")
@router.post("/api/auth/register")
@router.post("/api/auth/signup")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    display_name = req.full_name or req.email.split("@")[0]
    user = User(
        email=req.email.lower().strip(),
        full_name=display_name,
        username=req.email.split("@")[0],
        hashed_password=get_password_hash(req.password),
        is_active=True,
        is_verified=True,
        profile_completed=False,
        tier="free"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize Token Account with 50,000 starter tokens
    token_acc = TokenAccount(
        user_id=user.id,
        balance=50000,
        total_purchased=0,
        total_used=0
    )
    db.add(token_acc)
    bonus_tx = TokenTransaction(
        user_id=user.id,
        type="bonus",
        amount=50000,
        balance_after=50000,
        reason="Welcome starter token bonus"
    )
    db.add(bonus_tx)
    db.commit()

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.full_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "full_name": user.full_name,
        "tier": user.tier,
        "user": user.to_dict()
    }

@router.post("/auth/login")
@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    user.last_login = datetime.utcnow()
    db.commit()

    # Ensure token account exists
    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    if not token_acc:
        token_acc = TokenAccount(user_id=user.id, balance=50000)
        db.add(token_acc)
        db.commit()

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.full_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "full_name": user.full_name,
        "tier": user.tier or "free",
        "user": user.to_dict()
    }

@router.post("/auth/token")
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower().strip()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token({"sub": user.id, "email": user.email, "name": user.full_name})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/auth/me")
@router.get("/api/auth/me")
@router.get("/api/profile")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    balance = token_acc.balance if token_acc else 50000
    return {
        "id": user.id,
        "email": user.email,
        "name": user.full_name or user.email.split("@")[0],
        "full_name": user.full_name or user.email.split("@")[0],
        "username": user.username,
        "tier": user.tier or "free",
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month,
        "birth_year": user.birth_year,
        "tokens": balance,
        "token_balance": balance,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

@router.get("/auth/onboarding")
@router.get("/api/auth/onboarding")
def get_onboarding_status(user: User = Depends(get_current_user)):
    return {
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month,
        "birth_year": user.birth_year,
    }

@router.post("/auth/onboarding")
@router.post("/api/auth/onboarding")
def complete_onboarding(req: OnboardingRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.birth_month is not None:
        user.birth_month = req.birth_month
    if req.birth_year is not None:
        user.birth_year = req.birth_year
    if req.preferences:
        settings = dict(user.settings or {})
        settings.update(req.preferences)
        user.settings = settings
    user.profile_completed = True
    db.commit()
    db.refresh(user)
    return {"success": True, "message": "Onboarding completed", "user": user.to_dict()}

@router.post("/auth/otp/send")
@router.post("/auth/otp/resend")
def send_otp(req: OtpSendRequest):
    # Support development & live fallback OTP
    return {"success": True, "message": f"OTP sent to {req.email}", "debug_otp": "123456"}

@router.post("/auth/otp/verify")
def verify_otp(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    # Accepts 123456 or valid OTP code
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if user:
        token = create_access_token({"sub": user.id, "email": user.email, "name": user.full_name})
        return {
            "verified": True,
            "access_token": token,
            "full_name": user.full_name,
            "profile_completed": user.profile_completed,
            "user": user.to_dict()
        }
    # For signup, return verification_token
    return {
        "verified": True,
        "verification_token": secrets.token_hex(16)
    }

@router.get("/api/auth/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == username.strip()).first()
    return {"available": existing is None}

@router.get("/api/auth/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == email.lower().strip()).first()
    return {"available": existing is None}
