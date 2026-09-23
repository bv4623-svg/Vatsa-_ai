from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.utils.rate_limit import client_ip, enforce_rate_limit, reset_rate_limit

from app.database import get_db
from app.models.user import User
from app.models.token import TokenAccount
from app.auth.jwt import get_password_hash, verify_password, needs_rehash, create_access_token
from app.routers.auth.schemas import LoginRequest
from app.routers.auth.core.router import router


@router.post("/auth/login")
@router.post("/api/auth/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    # Throttle per-IP and per-account so neither a single source nor a
    # single target can be brute-forced.
    ip = client_ip(request)
    enforce_rate_limit(f"login:ip:{ip}", limit=5, window_seconds=900)
    enforce_rate_limit(f"login:email:{email}", limit=5, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    reset_rate_limit(f"login:ip:{ip}")
    reset_rate_limit(f"login:email:{email}")

    # Legacy pbkdf2_sha256 hashes are upgraded to bcrypt transparently now
    # that the plaintext password is known-correct -- no forced reset.
    # Committed immediately since the 2FA branch below returns early.
    if needs_rehash(user.hashed_password):
        user.hashed_password = get_password_hash(req.password)
        db.commit()

    if user.two_factor_enabled:
        # Password verified, but no real session token yet -- the
        # pending token only carries scope="2fa_pending" (rejected by
        # get_current_user like every other scoped token) and is
        # exchanged for a real one by POST /auth/2fa/verify-login.
        pending_token = create_access_token({"sub": str(user.id), "scope": "2fa_pending"}, expires_delta=timedelta(minutes=10))
        return {"requires_2fa": True, "pending_token": pending_token}

    user.last_login = datetime.utcnow()
    db.commit()

    token_acc = db.query(TokenAccount).filter_by(user_id=user.id).first()
    if not token_acc:
        db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
        db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier or "free",
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }


@router.post("/auth/token")
@router.post("/api/auth/token")
def login_form(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2-password-form login for interactive /docs use only. Held to
    the same bar as POST /auth/login -- it must not be a way to skip rate
    limiting, the deactivated-account check, or a 2FA requirement."""
    email = form_data.username.lower().strip()
    ip = client_ip(request)
    enforce_rate_limit(f"login:ip:{ip}", limit=5, window_seconds=900)
    enforce_rate_limit(f"login:email:{email}", limit=5, window_seconds=900)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")
    if user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="This account has 2FA enabled -- use POST /auth/login instead")

    reset_rate_limit(f"login:ip:{ip}")
    reset_rate_limit(f"login:email:{email}")

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {"access_token": token, "token_type": "bearer"}
