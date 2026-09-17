from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.account import build_account_export_zip

router = APIRouter()


@router.get("/api/account/export")
def export_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    zip_bytes = build_account_export_zip(db, user)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="vatsa-export-{user.id}.zip"'},
    )
