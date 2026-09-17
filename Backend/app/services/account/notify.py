import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.notification import Notification
from app.utils.email import send_notification_email

logger = logging.getLogger("AccountNotify")


def notify_user(db: Session, user: User, type: str, title: str, message: Optional[str] = None, send_email: bool = False) -> None:
    """The one real place an event becomes a notification -- gated on the
    user's own stored preferences, never sent unconditionally. In-app row
    and email are independent: either, both, or neither fire depending
    on notifyInApp/notifyEmail."""
    settings = user.settings or {}

    if settings.get("notifyInApp", True):
        db.add(Notification(id=uuid.uuid4().hex, user_id=user.id, type=type, title=title, message=message))
        db.commit()

    if send_email and settings.get("notifyEmail", True):
        try:
            send_notification_email(user.email, title, message)
        except Exception:
            logger.exception("Failed to send notification email to user %s", user.id)


def notify_quota_warning(db: Session, user: User, used_bytes: int, limit_bytes: int, at_limit: bool) -> None:
    settings = user.settings or {}
    if not settings.get("notifyQuotaWarnings", True):
        return
    title = "You're out of storage" if at_limit else "Approaching your storage limit"
    message = f"{used_bytes} of {limit_bytes} bytes used."
    notify_user(db, user, type="quota_warning", title=title, message=message, send_email=True)
