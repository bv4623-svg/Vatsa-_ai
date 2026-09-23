from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.jwt import get_password_hash, decode_access_token
from app.services.password_policy import validate_password_strength
from app.routers.auth.schemas import ResetPasswordRequest
from app.routers.auth.otp.router import router


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

    validate_password_strength(req.password)
    user.hashed_password = get_password_hash(req.password)
    # Every access token issued before this point -- including one an
    # attacker who triggered the reset might already hold -- stops working
    # on its next request (see get_current_user's token_version check).
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return {"success": True, "message": "Password reset successfully"}
