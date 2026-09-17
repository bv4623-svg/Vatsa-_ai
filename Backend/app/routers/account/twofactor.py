from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.auth.jwt import verify_password
from app.services.account import (
    generate_totp_secret, generate_qr_data_uri, verify_totp_code,
    generate_backup_codes, hash_backup_codes,
)
from app.routers.account.schemas import Verify2FARequest, Disable2FARequest

router = APIRouter()


@router.post("/api/account/2fa/setup")
def setup_2fa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="Two-factor authentication is already enabled")
    secret = generate_totp_secret()
    user.totp_secret = secret  # not active until /enable confirms a real code against it
    db.commit()
    return {"secret": secret, "qrDataUri": generate_qr_data_uri(secret, user.email)}


@router.post("/api/account/2fa/enable")
def enable_2fa(payload: Verify2FARequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Call /api/account/2fa/setup first")
    if not verify_totp_code(user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    plaintext_codes = generate_backup_codes()
    user.backup_codes = hash_backup_codes(plaintext_codes)
    user.two_factor_enabled = True
    flag_modified(user, "backup_codes")
    db.commit()
    return {"enabled": True, "backupCodes": plaintext_codes}


@router.post("/api/account/2fa/disable")
def disable_2fa(payload: Disable2FARequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user.two_factor_enabled = False
    user.totp_secret = None
    user.backup_codes = []
    flag_modified(user, "backup_codes")
    db.commit()
    return {"enabled": False}
