from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.user import User
from app.auth.jwt import create_access_token, decode_access_token
from app.services.account import verify_totp_code, consume_backup_code

router = APIRouter(tags=["authentication"])


class Verify2FALoginRequest(BaseModel):
    pending_token: str
    code: str = Field(..., min_length=4, max_length=10)


@router.post("/auth/2fa/verify-login")
@router.post("/api/auth/2fa/verify-login")
def verify_login_2fa(req: Verify2FALoginRequest, db: Session = Depends(get_db)):
    payload = decode_access_token(req.pending_token)
    if not payload or payload.get("scope") != "2fa_pending":
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA session")

    sub = payload.get("sub")
    user = db.query(User).filter(User.id == int(sub)).first() if sub and str(sub).isdigit() else None
    if not user or not user.two_factor_enabled:
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA session")

    ok = verify_totp_code(user.totp_secret, req.code) or consume_backup_code(user, req.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid code")
    flag_modified(user, "backup_codes")
    db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
    return {
        "access_token": token, "token_type": "bearer",
        "full_name": user.full_name, "tier": user.tier or "free",
        "profile_completed": user.profile_completed,
        "user": user.to_dict(),
    }
