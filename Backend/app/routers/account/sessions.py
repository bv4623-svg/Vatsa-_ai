from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.account import sign_out_other_devices

router = APIRouter()


@router.post("/api/account/sessions/sign-out-others")
def sign_out_others(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Real revocation, not decorative: every access token issued before
    this call fails get_current_user's token_version check on its next
    request. Returns a fresh token for the device that asked, so calling
    this doesn't also sign the caller out."""
    new_token = sign_out_other_devices(db, user)
    return {"access_token": new_token, "token_type": "bearer"}
