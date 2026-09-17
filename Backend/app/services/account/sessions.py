from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token
from app.models.user import User


def sign_out_other_devices(db: Session, user: User) -> str:
    """Bumps token_version so every previously-issued access token
    (every other signed-in device/tab) fails get_current_user's tv
    check on its next request, then immediately mints a fresh token for
    THIS request so the device that asked isn't also logged out."""
    user.token_version += 1
    db.commit()
    db.refresh(user)
    return create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name, "tv": user.token_version})
