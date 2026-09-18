import os
import secrets
from urllib.parse import urlencode

from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction
from app.auth.jwt import get_password_hash, create_access_token

FRONTEND_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:3000")


def get_or_create_oauth_user(db: Session, email: str, name: str, provider: str) -> User:
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
    db.flush()  # assigns user.id within the same transaction, without committing yet

    db.add(TokenAccount(user_id=user.id, balance=50000, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=50000,
        balance_after=50000, reason=f"Welcome bonus via {provider}",
    ))
    db.commit()
    db.refresh(user)
    return user


def redirect_with_token(user: User) -> RedirectResponse:
    jwt_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    qs = urlencode({
        "access_token": jwt_token,
        "email": user.email,
        "full_name": user.full_name or "",
        "tier": user.tier or "free",
        "profile_completed": "true" if user.profile_completed else "false",
    })
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{qs}")


def redirect_with_error(error: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error}")
