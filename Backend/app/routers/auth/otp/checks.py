from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth.otp.router import router


@router.get("/api/auth/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.username == username.strip()).first() is None}


@router.get("/api/auth/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    return {"available": db.query(User).filter(User.email == email.lower().strip()).first() is None}
