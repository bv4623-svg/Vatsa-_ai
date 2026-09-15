"""
app/auth/oauth.py – Merged & Cleaned OAuth module
- JWT helpers (create_access_token, decode_access_token, get_current_user)
- Disposable email check
- OTP-based authentication with hashed OTPs, resend, attempts, rate limiting
- Registration, login, password reset, onboarding
- Google OAuth 2.0 (login, callback, token verification)
- Combined router named `router` for easy import in main.py
All settings loaded from environment variables (no external config required).
"""

import os
import random
import secrets
import string
import logging
from datetime import datetime, timedelta
from urllib.parse import urlencode
from typing import Optional

import httpx
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from jose import JWTError, jwt

# Email sending
try:
    from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
    HAS_MAIL = True
except ImportError:
    HAS_MAIL = False
    logging.warning("fastapi-mail not installed – email sending will be disabled.")

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP

logger = logging.getLogger(__name__)

# ================================================================
#  SETTINGS (from environment)
# ================================================================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7))

# ================================================================
#  JWT HELPERS
# ================================================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

# ─── REPLACED get_current_user WITH AUTO-CREATE (DEV ONLY) ───
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int = payload.get("sub")
    email: str = payload.get("email")
    name: str = payload.get("name", email.split("@")[0] if email else "Unknown")

    if user_id is None:
        raise credentials_exception

    # Try to fetch existing user by ID
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None and email:
        # 🔥 DEV‑ONLY: auto‑create user when token exists but DB record is missing
        logger.warning(f"Auto‑creating user for email {email} (user ID {user_id} not found)")
        hashed = bcrypt.hashpw("dummy".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        new_user = User(
            id=user_id,           # use ID from token; remove if you want DB‑assigned
            email=email,
            full_name=name,
            hashed_password=hashed,
            is_verified=True,
            is_active=True,
            profile_completed=False,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
            settings={}
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        user = new_user

    if user is None:
        raise credentials_exception

    return user
# ─── END REPLACEMENT ───

# ─── Disposable Email Check ───
DISPOSABLE_DOMAINS = {"tempmail.com", "10minutemail.com", "guerrillamail.com", "mailinator.com", "yopmail.com"}
def is_disposable_email(email: str) -> bool:
    return email.split('@')[-1].lower() in DISPOSABLE_DOMAINS

# ================================================================
#  MAIL CONFIG (for OTP)
# ================================================================
def get_mail_config() -> Optional[ConnectionConfig]:
    username = os.getenv("EMAIL_USERNAME")
    password = os.getenv("EMAIL_PASSWORD")
    server = os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("EMAIL_SMTP_PORT", 587))
    if not username or not password:
        logger.warning("Email credentials not set. OTP emails will not be sent.")
        return None
    return ConnectionConfig(
        MAIL_USERNAME=username,
        MAIL_PASSWORD=password,
        MAIL_FROM=username,
        MAIL_PORT=port,
        MAIL_SERVER=server,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
    )

async def send_otp_email(email: str, otp: str, purpose: str):
    """Send OTP via email (background task)."""
    logger.info(f"Sending OTP to {email} for {purpose}")
    if not HAS_MAIL:
        logger.warning("fastapi-mail not installed – skipping email send.")
        return
    conf = get_mail_config()
    if conf is None:
        logger.warning("Email credentials missing – skipping send.")
        return
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
        logger.error(f"Email send failed: {e}")

# ================================================================
#  PART 1 – OTP / Email-Password Auth Router (/auth)
# ================================================================
router_auth = APIRouter(prefix="/auth", tags=["auth"])

# ─── Pydantic Schemas ───
class SendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str  # "signup", "login", or "reset"

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2)
    password: str = Field(..., min_length=8)
    verification_token: str  # JWT from OTP verification

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str  # JWT from OTP verification
    new_password: str = Field(..., min_length=8)

class OnboardingRequest(BaseModel):
    birth_month: int = Field(..., ge=1, le=12)
    birth_year: int = Field(..., ge=1950, le=datetime.utcnow().year)

# ─── OTP Endpoints ───
@router_auth.post("/otp/send")
async def send_otp(
    req: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Send OTP for signup, login, or password reset.
    For reset, returns generic success to avoid email enumeration.
    """
    if req.purpose not in ["signup", "login", "reset"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid purpose")

    # Disposable email check (only for signup/login to avoid abuse)
    if req.purpose in ["signup", "login"] and is_disposable_email(req.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Disposable email not allowed")

    # Check user existence for signup/login, but for reset we don't reveal existence
    user_result = await db.execute(select(User).where(User.email == req.email))
    user = user_result.scalar_one_or_none()

    if req.purpose == "signup":
        if user:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered. Please login.")
    elif req.purpose == "login":
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Email not registered. Please sign up.")
    # For reset: if user not found, still return success (to avoid enumeration)
    if req.purpose == "reset" and not user:
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

    # Send OTP via email (background)
    background_tasks.add_task(send_otp_email, req.email, otp_code, req.purpose)

    return {"message": "OTP sent successfully"}

@router_auth.post("/otp/verify")
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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No active OTP found. Please request a new one.")

    # Check attempts limit (max 5)
    if otp_entry.attempts >= 5:
        otp_entry.is_used = True  # block further attempts
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Too many failed attempts. Please request a new OTP.")

    # Verify OTP using bcrypt
    if not bcrypt.checkpw(req.otp.encode('utf-8'), otp_entry.code_hash.encode('utf-8')):
        otp_entry.attempts += 1
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    # Mark as verified and used
    otp_entry.is_verified = True
    otp_entry.is_used = True
    await db.commit()

    # Handle different purposes
    if otp_entry.purpose == "reset":
        # Generate short-lived JWT reset token
        reset_token = create_access_token(
            {"sub": req.email, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=10)
        )
        return {"verified": True, "reset_token": reset_token}

    elif otp_entry.purpose == "login":
        # Login via OTP
        user_result = await db.execute(select(User).where(User.email == req.email))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
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
        # Return JWT for registration
        ver_token = create_access_token(
            {"email": req.email, "purpose": "registration"},
            expires_delta=timedelta(minutes=10)
        )
        return {"verified": True, "verification_token": ver_token}

@router_auth.post("/otp/resend")
async def resend_otp(
    req: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No active OTP to resend. Please request a new one.")

    # Cooldown: at least 60 seconds since creation
    if (datetime.utcnow() - otp_entry.created_at).total_seconds() < 60:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Please wait 60 seconds before resending.")

    # Max resends: 3
    if otp_entry.resend_count >= 3:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Maximum resend attempts reached. Request a new OTP.")

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

@router_auth.post("/register")
async def register(
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Complete registration using the verification token from OTP verification.
    """
    try:
        payload = decode_access_token(req.verification_token)
        if payload.get("purpose") != "registration":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid token purpose")
        email = payload.get("email")
        if email != req.email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email mismatch")
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

    # Hash password and create user
    hashed = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
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

    # Generate access token
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

@router_auth.post("/login")
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Standard email/password login.
    """
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.hashed_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This account uses Google login. Please use Google.")
    if not bcrypt.checkpw(req.password.encode("utf-8"), user.hashed_password.encode("utf-8")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

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

@router_auth.post("/password/reset")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using the reset_token from OTP verification.
    """
    try:
        payload = decode_access_token(req.reset_token)
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
        token_email = payload.get("sub")
        if token_email != req.email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email mismatch")
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    # Update password
    hashed = bcrypt.hashpw(req.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user.hashed_password = hashed
    await db.commit()
    return {"message": "Password reset successfully"}

# ─── User Info & Settings ───
@router_auth.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "profile_completed": current_user.profile_completed,
    }

@router_auth.get("/settings")
async def get_user_settings(current_user: User = Depends(get_current_user)):
    return current_user.settings or {}

@router_auth.put("/settings")
async def update_user_settings(
    req: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current = current_user.settings or {}
    current.update(req)
    current_user.settings = current
    await db.commit()
    await db.refresh(current_user)
    return current_user.settings

# ─── Onboarding ───
@router_auth.get("/onboarding")
async def get_onboarding_status(current_user: User = Depends(get_current_user)):
    return {
        "profile_completed": current_user.profile_completed,
        "birth_month": current_user.birth_month,
        "birth_year": current_user.birth_year,
    }

@router_auth.post("/onboarding")
async def complete_onboarding(
    req: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Complete or update onboarding information.
    Idempotent: if already completed, returns 200 with completed=True.
    """
    try:
        if current_user.profile_completed:
            logger.info(f"Onboarding already completed for user {current_user.email}")
            return {
                "message": "Onboarding already completed",
                "completed": True,
                "birth_month": current_user.birth_month,
                "birth_year": current_user.birth_year,
            }
        
        # Validate birth_month and birth_year (Pydantic already does)
        current_user.birth_month = req.birth_month
        current_user.birth_year = req.birth_year
        current_user.profile_completed = True
        await db.commit()
        logger.info(f"Onboarding completed for user {current_user.email}")
        return {
            "message": "Onboarding completed successfully",
            "completed": True,
            "birth_month": req.birth_month,
            "birth_year": req.birth_year,
        }
    except HTTPException as e:
        logger.error(f"Onboarding error for user {current_user.email}: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected onboarding error for user {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during onboarding")

# ─── TEMPORARY: Create Test User for Razorpay verification ───
@router_auth.post("/create-test-user")
async def create_test_user(db: AsyncSession = Depends(get_db)):
    """
    🔧 ONE-TIME USE: Creates a test user with known credentials.
    Delete this endpoint after Razorpay approves your website.
    """
    email = "test@vatsaai.com"
    password = "Test@123"
    
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return {"message": "Test user already exists", "email": email}
    
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        email=email,
        full_name="Razorpay Test User",
        hashed_password=hashed,
        is_verified=True,
        profile_completed=False,
        created_at=datetime.utcnow(),
        last_login=datetime.utcnow()
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "Test user created successfully",
        "email": email,
        "password": password
    }

# ================================================================
#  PART 2 – Google OAuth Router (/auth/google)
# ================================================================
router_google = APIRouter(prefix="/auth/google", tags=["google"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
FRONTEND_REDIRECT_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000")

@router_google.get("/login")
async def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return JSONResponse(status_code=500, content={"error": "Google OAuth not configured"})
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url=auth_url)

@router_google.get("/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return JSONResponse(status_code=500, content={"error": "Google OAuth not configured"})

    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Authorization code missing")

    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data=token_data)
        if resp.status_code != 200:
            logger.error(f"Token exchange failed: {resp.text}")
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Failed to exchange code")
        token_json = resp.json()
        access_token = token_json.get("access_token")
        if not access_token:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No access token")

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Failed to fetch user info")
        userinfo = userinfo_resp.json()

    email = userinfo.get("email")
    name = userinfo.get("name", "Google User")
    google_id = userinfo.get("id")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No email from Google")
    if is_disposable_email(email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Disposable email not allowed")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            email=email,
            full_name=name,
            google_id=google_id,
            is_verified=True,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
            profile_completed=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.google_id = google_id
        user.full_name = name
        user.is_verified = True
        user.last_login = datetime.utcnow()
        await db.commit()

    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    # Redirect to frontend callback with token
    return RedirectResponse(url=f"{FRONTEND_REDIRECT_URL}/auth/callback?token={access_token}")

@router_google.get("/verify")
async def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"valid": True, "user": payload}

# ================================================================
#  COMBINED ROUTER (for easy import in main.py)
# ================================================================
router = APIRouter()
router.include_router(router_auth)
router.include_router(router_google)

__all__ = ["router", "router_auth", "router_google"]