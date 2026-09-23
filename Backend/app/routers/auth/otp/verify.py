import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP
from app.auth.jwt import create_access_token
from app.routers.auth.schemas import OtpVerifyRequest
from app.routers.auth.otp.router import router


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

        # "tv" (token_version) must be on every login token -- it's what lets
        # a password reset or "sign out other devices" revoke a session (see
        # get_current_user). Every other login path (core.py, oauth/shared.py,
        # twofactor.py) already sets it; this one was missing it, which meant
        # a token minted via OTP login stayed valid forever, even through a
        # password reset that was supposed to kill it.
        token = create_access_token(
            {"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version}
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
