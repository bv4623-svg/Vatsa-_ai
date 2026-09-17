from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.auth.jwt import verify_password
from app.services.account import soft_delete_account, HARD_DELETE_GRACE_DAYS
from app.routers.account.schemas import DeleteAccountRequest

router = APIRouter()


@router.post("/api/account/delete")
def delete_account(payload: DeleteAccountRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    soft_delete_account(db, user)
    return {"deleted": True, "gracePeriodDays": HARD_DELETE_GRACE_DAYS}
