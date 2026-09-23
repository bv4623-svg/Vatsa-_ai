from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.utils.rate_limit import client_ip, enforce_rate_limit

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, create_access_token
from app.routers.auth.schemas import RegisterRequest
from app.services.password_policy import validate_password_strength
from app.routers.auth.core.router import router


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

    validate_password_strength(req.password)

    # Proves this exact email actually received and echoed back a real OTP
    # (see /auth/otp/send + /auth/otp/verify, purpose="signup") before an
    # account is created for it -- registering no longer activates an
    # account for an email address nobody confirmed ownership of.
    verified_otp = (
        db.query(OTP)
        .filter(OTP.email == email, OTP.purpose == "signup", OTP.verification_token == req.verification_token)
        .first()
    )
    if not verified_otp:
        raise HTTPException(status_code=400, detail="Email verification required. Request a code via /auth/otp/send first.")

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

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier,
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }
