from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.routers.auth.schemas import OnboardingRequest
from app.routers.auth.core.router import router


# ═══════════════════════════════════════════════════════════
# ONBOARDING
# ═══════════════════════════════════════════════════════════
@router.get("/auth/onboarding")
@router.get("/api/auth/onboarding")
def get_onboarding_status(user: User = Depends(get_current_user)):
    return {
        "profile_completed": user.profile_completed,
        "birth_month": user.birth_month, "birth_year": user.birth_year,
    }


@router.post("/auth/onboarding")
@router.post("/api/auth/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.birth_month is not None: user.birth_month = req.birth_month
    if req.birth_year is not None:  user.birth_year  = req.birth_year
    if req.preferences:
        settings = dict(user.settings or {})
        settings.update(req.preferences)
        user.settings = settings
    user.profile_completed = True
    db.commit()
    db.refresh(user)
    return {"success": True, "message": "Onboarding completed", "user": user.to_dict()}
