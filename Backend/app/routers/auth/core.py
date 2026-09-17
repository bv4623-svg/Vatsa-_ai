from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime

from app.utils.rate_limit import client_ip, enforce_rate_limit, reset_rate_limit

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_current_user
from app.routers.auth.schemas import RegisterRequest, LoginRequest, OnboardingRequest
from app.services.feature_access import user_tier, check_daily_limit

router = APIRouter(tags=["authentication"])


# ═══════════════════════════════════════════════════════════
# REGISTER / LOGIN
# ═══════════════════════════════════════════════════════════
@router.post("/auth/register")
@router.post("/api/auth/register")
@router.post("/api/auth/signup")
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    enforce_rate_limit(f"register:ip:{client_ip(request)}", limit=5, window_seconds=600)

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
    db.flush()  # assigns user.id within the same transaction, without committing yet

    db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=50000,
        balance_after=50000, reason="Welcome starter token bonus",
    ))
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier,
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }


@router.post("/auth/login")
@router.post("/api/auth/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    # Throttle per-IP and per-account so neither a single source nor a
    # single target can be brute-forced.
    ip = client_ip(request)
    enforce_rate_limit(f"login:ip:{ip}", limit=10, window_seconds=300)
    enforce_rate_limit(f"login:email:{email}", limit=5, window_seconds=300)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    reset_rate_limit(f"login:ip:{ip}")
    reset_rate_limit(f"login:email:{email}")

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
    tier = user_tier(user)
    usage = {}
    for feature in ("chat_messages", "code_messages", "image_gen", "web_search"):
        _, used, limit = check_daily_limit(db, user, feature)
        usage[feature] = {"used": used, "limit": limit}
    return {
        "id": user.id, "email": user.email,
        "name": user.full_name or user.email.split("@")[0],
        "full_name": user.full_name or user.email.split("@")[0],
        "username": user.username, "tier": tier,
        "is_active": user.is_active, "is_verified": user.is_verified,
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
        "tokens": balance, "token_balance": balance,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "usage": usage,
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
