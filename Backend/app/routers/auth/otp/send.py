import logging
import os
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.otp import OTP
from app.utils.email import send_otp_email
from app.utils.rate_limit import client_ip, enforce_rate_limit
from app.routers.auth.schemas import OtpSendRequest
from app.routers.auth.otp.router import router, RESEND_COOLDOWN_SECONDS, _DEBUG_LOG_OTP

logger = logging.getLogger("AuthOTP")


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

    # Minimum gap between consecutive sends to this email+purpose (see
    # RESEND_COOLDOWN_SECONDS) -- independent of the 5-per-10-min cap below,
    # which only stops sustained abuse, not a user double-clicking "resend".
    enforce_rate_limit(f"otp-cooldown:{email}:{purpose}", limit=1, window_seconds=RESEND_COOLDOWN_SECONDS)

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

    if _DEBUG_LOG_OTP:
        # Local development only (see _DEBUG_LOG_OTP above) -- never enabled
        # by default, so a real OTP code can never end up in production logs.
        print(f"\n[OTP][DEBUG_LOG_OTP] Generated for {email}: {code}  (purpose={purpose})\n", flush=True)
    else:
        logger.info(f"OTP generated for {email} (purpose={purpose})")

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
