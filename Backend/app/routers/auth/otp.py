from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import secrets

from app.database import get_db
from app.models.user import User
from app.models.otp import OTP
from app.auth.jwt import get_password_hash, create_access_token, decode_access_token
from app.utils.email import send_otp_email
from app.utils.rate_limit import client_ip, enforce_rate_limit
from app.services.password_policy import validate_password_strength
from app.routers.auth.schemas import OtpSendRequest, OtpVerifyRequest, ResetPasswordRequest

router = APIRouter(tags=["authentication"])


# ═══════════════════════════════════════════════════════════
# OTP  (REAL EMAIL)
# ═══════════════════════════════════════════════════════════
@router.post("/auth/otp/send")
@router.post("/api/auth/otp/send")
def send_otp(req: OtpSendRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    purpose = req.purpose or "signup"

    # Per-IP cap on top of the per-email one below, so one source can't
    # spray OTP requests (and outbound emails) across many target addresses.
    enforce_rate_limit(f"otp-send:ip:{client_ip(request)}", limit=20, window_seconds=600)

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

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp = OTP.create_otp(email, purpose, code, expires_in_minutes=5)
    db.add(otp)
    db.commit()

    print(f"\n[OTP] Generated for {email}: {code}  (purpose={purpose})\n", flush=True)

    missing = [k for k in ("EMAIL_USERNAME", "EMAIL_PASSWORD") if not os.getenv(k)]
    if missing:
        # Distinguish "this server can't send email" from "sending failed",
        # so the UI can say which env vars are missing instead of showing a
        # generic 500 the user can do nothing about.
        raise HTTPException(
            status_code=503,
            detail=(
                "Email delivery is not configured on this server. "
                f"Missing environment variable(s): {', '.join(missing)}."
            ),
        )

    sent = send_otp_email(email, code, purpose)
    if not sent:
        raise HTTPException(502, "Could not send the email. Check the SMTP credentials and try again.")

    return {"success": True, "message": f"OTP sent to {email}"}


@router.post("/auth/otp/resend")
@router.post("/api/auth/otp/resend")
def resend_otp(req: OtpSendRequest, request: Request, db: Session = Depends(get_db)):
    return send_otp(req, request, db)


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

    validate_password_strength(req.password)
    user.hashed_password = get_password_hash(req.password)
    # Every access token issued before this point -- including one an
    # attacker who triggered the reset might already hold -- stops working
    # on its next request (see get_current_user's token_version check).
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return {"success": True, "message": "Password reset successfully"}


@router.get("/api/auth/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.username == username.strip()).first() is None}


@router.get("/api/auth/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.email == email.lower().strip()).first() is None}
