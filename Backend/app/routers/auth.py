from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from urllib.parse import urlencode
import os, secrets, random
import httpx

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.models.otp import OTP
from app.auth.jwt import get_password_hash, verify_password, create_access_token, decode_access_token
from app.auth.dependencies import get_current_user
from app.utils.email import send_otp_email

router = APIRouter(tags=["authentication"])

# ── ENV ────────────────────────────────────────────────────
FRONTEND_URL         = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000")
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "")
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI  = os.getenv("GITHUB_REDIRECT_URI", "")
MS_CLIENT_ID         = os.getenv("MICROSOFT_CLIENT_ID", "")
MS_CLIENT_SECRET     = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MS_TENANT            = os.getenv("MICROSOFT_TENANT", "common")
MS_REDIRECT_URI      = os.getenv("MICROSOFT_REDIRECT_URI", "")


# ── SCHEMAS ────────────────────────────────────────────────
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

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    reset_token: str


# ═══════════════════════════════════════════════════════════
# REGISTER / LOGIN
# ═══════════════════════════════════════════════════════════
@router.post("/auth/register")
@router.post("/api/auth/register")
@router.post("/api/auth/signup")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    display_name = req.full_name or email.split("@")[0]

    # Ensure unique username
    base_username = email.split("@")[0]
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    user = User(
        email=email,
        full_name=display_name,
        username=username,
        hashed_password=get_password_hash(req.password),
        is_active=True,
        is_verified=True,
        profile_completed=False,
        tier="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=50000,
        balance_after=50000, reason="Welcome starter token bonus",
    ))
    db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier,
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }


@router.post("/auth/login")
@router.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    user.last_login = datetime.utcnow()
    db.commit()

    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    if not token_acc:
        db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
        db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier or "free",
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }


@router.post("/auth/token")
@router.post("/api/auth/token")
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form_data.username.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {"access_token": token, "token_type": "bearer"}


# ═══════════════════════════════════════════════════════════
# PROFILE / ME
# ═══════════════════════════════════════════════════════════
@router.get("/auth/me")
@router.get("/api/auth/me")
@router.get("/api/profile")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    balance = token_acc.balance if token_acc else 50000
    return {
        "id": user.id, "email": user.email,
        "name": user.full_name or user.email.split("@")[0],
        "full_name": user.full_name or user.email.split("@")[0],
        "username": user.username, "tier": user.tier or "free",
        "is_active": user.is_active, "is_verified": user.is_verified,
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
        "tokens": balance, "token_balance": balance,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ═══════════════════════════════════════════════════════════
# ONBOARDING
# ═══════════════════════════════════════════════════════════
@router.get("/auth/onboarding")
@router.get("/api/auth/onboarding")
def get_onboarding_status(user: User = Depends(get_current_user)):
    return {
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
    }


@router.post("/auth/onboarding")
@router.post("/api/auth/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.birth_month is not None: user.birth_month = req.birth_month
    if req.birth_year is not None:  user.birth_year  = req.birth_year
    if req.preferences:
        settings = dict(user.settings or {})
        settings.update(req.preferences)
        user.settings = settings
    user.profile_completed = True
    db.commit()
    db.refresh(user)
    return {"success": True, "message": "Onboarding completed", "user": user.to_dict()}


# ═══════════════════════════════════════════════════════════
# OTP  (REAL EMAIL)
# ═══════════════════════════════════════════════════════════
@router.post("/auth/otp/send")
@router.post("/api/auth/otp/send")
def send_otp(req: OtpSendRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    purpose = req.purpose or "signup"

    # Rate limit — max 5 in 10 min
    recent = (
        db.query(OTP)
        .filter(
            OTP.email == email,
            OTP.created_at > datetime.utcnow() - timedelta(minutes=10),
        )
        .count()
    )
    if recent >= 5:
        raise HTTPException(429, "Too many OTP requests. Wait 10 minutes.")

    # Invalidate previous unused OTPs for same email+purpose
    db.query(OTP).filter(
        OTP.email == email,
        OTP.purpose == purpose,
        OTP.is_used == False,  # noqa: E712
    ).update({"is_used": True}, synchronize_session=False)
    db.commit()

    code = f"{random.randint(0, 999999):06d}"
    otp = OTP.create_otp(email, purpose, code, expires_in_minutes=5)
    db.add(otp)
    db.commit()

    print(f"\n[OTP] Generated for {email}: {code}  (purpose={purpose})\n", flush=True)

    sent = send_otp_email(email, code, purpose)
    if not sent:
        raise HTTPException(500, "Failed to send email. Check SMTP config.")

    return {"success": True, "message": f"OTP sent to {email}"}


@router.post("/auth/otp/resend")
@router.post("/api/auth/otp/resend")
def resend_otp(req: OtpSendRequest, db: Session = Depends(get_db)):
    return send_otp(req, db)


@router.post("/auth/otp/verify")
@router.post("/api/auth/otp/verify")
def verify_otp(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    # Latest active OTP for this email
    record = (
        db.query(OTP)
        .filter(
            OTP.email == email,
            OTP.is_used == False,       # noqa: E712
            OTP.is_verified == False,   # noqa: E712
            OTP.expires_at > datetime.utcnow(),
        )
        .order_by(OTP.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(400, "Invalid or expired OTP")

    # Max 5 wrong attempts
    if record.attempts >= 5:
        record.mark_as_used()
        db.commit()
        raise HTTPException(400, "Too many wrong attempts. Request a new OTP.")

    if not record.verify_code(req.otp):
        record.attempts += 1
        db.commit()
        raise HTTPException(400, "Invalid OTP")

    # Mark verified + used
    record.mark_as_verified()
    record.mark_as_used()
    db.commit()

    # Password-reset flow: hand back a short-lived reset token, do NOT log in
    if record.purpose == "reset":
        reset_token = create_access_token(
            {"sub": email, "email": email, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=10),
        )
        return {"verified": True, "reset_token": reset_token}

    # Existing user (e.g. OTP-based login) → login token
    user = db.query(User).filter(User.email == email).first()
    if user:
        if not user.is_active:
            raise HTTPException(400, "User account is deactivated")

        token = create_access_token(
            {"sub": str(user.id), "email": user.email, "name": user.full_name}
        )
        return {
            "verified": True,
            "access_token": token,
            "token_type": "bearer",
            "full_name": user.full_name,
            "profile_completed": user.profile_completed,
            "user": user.to_dict(),
        }

    # New user (signup flow) → verification token
    vtoken = secrets.token_hex(16)
    try:
        record.verification_token = vtoken
        db.commit()
    except Exception:
        db.rollback()

    return {"verified": True, "verification_token": vtoken}


@router.post("/auth/reset-password")
@router.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = decode_access_token(req.reset_token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(400, "Invalid or expired reset token")

    email = req.email.lower().strip()
    token_email = payload.get("email") or payload.get("sub")
    if token_email != email:
        raise HTTPException(400, "Email mismatch")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.hashed_password = get_password_hash(req.password)
    db.commit()
    return {"success": True, "message": "Password reset successfully"}


@router.get("/api/auth/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.username == username.strip()).first() is None}


@router.get("/api/auth/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.email == email.lower().strip()).first() is None}


# ═══════════════════════════════════════════════════════════
# OAUTH — Shared helpers
# ═══════════════════════════════════════════════════════════
def _get_or_create_oauth_user(db: Session, email: str, name: str, provider: str):
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    base_username = email.split("@")[0] + "_" + provider
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    user = User(
        email=email, full_name=name,
        username=username,
        hashed_password=get_password_hash(secrets.token_hex(24)),
        is_active=True, is_verified=True,
        profile_completed=False, tier="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=50000,
        balance_after=50000, reason=f"Welcome bonus via {provider}",
    ))
    db.commit()
    return user


def _redirect_with_token(user: User):
    jwt_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    qs = urlencode({
        "access_token": jwt_token,
        "email": user.email,
        "full_name": user.full_name or "",
        "tier": user.tier or "free",
        "profile_completed": "true" if user.profile_completed else "false",
    })
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{qs}")


# ═══════════════════════════════════════════════════════════
# GOOGLE OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/google/login")
@router.get("/api/auth/google/login")
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(500, "Google OAuth not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))


@router.get("/auth/google/callback")
@router.get("/api/auth/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        tok = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        access_token = tok.json().get("access_token")
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=google_token_failed")

        res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("email") or "").lower().strip()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=google_no_email")
    name = info.get("name") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "google")
    return _redirect_with_token(user)


# ═══════════════════════════════════════════════════════════
# GITHUB OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/github/login")
@router.get("/api/auth/github/login")
def github_login():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(500, "GitHub OAuth not configured")
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
    }
    return RedirectResponse("https://github.com/login/oauth/authorize?" + urlencode(params))


@router.get("/auth/github/callback")
@router.get("/api/auth/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        tok = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code, "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )
        access_token = tok.json().get("access_token")
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=github_token_failed")

        headers = {"Authorization": f"Bearer {access_token}"}
        res = await client.get("https://api.github.com/user", headers=headers)
        info = res.json()

        email = info.get("email")
        if not email:
            er = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = er.json() if isinstance(er.json(), list) else []
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                emails[0] if emails else None,
            )
            email = primary.get("email") if primary else None

    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=github_no_email")
    name = info.get("name") or info.get("login") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "github")
    return _redirect_with_token(user)


# ═══════════════════════════════════════════════════════════
# MICROSOFT OAUTH
# ═══════════════════════════════════════════════════════════
@router.get("/auth/microsoft/login")
@router.get("/api/auth/microsoft/login")
def microsoft_login():
    if not MS_CLIENT_ID or not MS_CLIENT_SECRET:
        raise HTTPException(500, "Microsoft OAuth not configured")
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": "openid email profile User.Read",
    }
    url = f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/authorize?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/auth/microsoft/callback")
@router.get("/api/auth/microsoft/callback")
async def microsoft_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        tok = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
            data={
                "client_id": MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "code": code, "redirect_uri": MS_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        access_token = tok.json().get("access_token")
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=microsoft_token_failed")

        res = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = res.json()

    email = (info.get("mail") or info.get("userPrincipalName") or "").lower().strip()
    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=microsoft_no_email")
    name = info.get("displayName") or email.split("@")[0]

    user = _get_or_create_oauth_user(db, email, name, "microsoft")
    return _redirect_with_token(user)
