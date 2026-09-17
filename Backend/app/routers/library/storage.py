from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.library import get_storage_usage

router = APIRouter()


@router.get("/api/library/storage")
def storage_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Real usage: SUM(size_bytes) grouped by type, compared against the
    plan's storageLimitGB. Never a placeholder number."""
    return get_storage_usage(db, user)
