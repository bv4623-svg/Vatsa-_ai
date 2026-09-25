import html
import os

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import ContactMessage
from app.utils.email import _send
from app.utils.rate_limit import client_ip, enforce_rate_limit

router = APIRouter(tags=["contact"])

CONTACT_NOTIFICATION_EMAIL = os.getenv("CONTACT_NOTIFICATION_EMAIL", "contact@vatsaai.com")


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    interest: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


@router.post("/contact")
@router.post("/api/contact")
def submit_contact(req: ContactRequest, request: Request, db: Session = Depends(get_db)):
    """Stores every submission as a real row -- that's the actual record of
    what a visitor sent, independent of whether the notification email below
    is configured or happens to fail. The email is a best-effort convenience
    on top of it, not the source of truth."""
    enforce_rate_limit(f"contact:ip:{client_ip(request)}", limit=5, window_seconds=3600)

    row = ContactMessage(
        name=req.name.strip(),
        email=str(req.email),
        interest=(req.interest or "").strip() or None,
        message=req.message.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    html_body = f"""
    <p><strong>From:</strong> {html.escape(row.name)} &lt;{html.escape(row.email)}&gt;</p>
    <p><strong>Interested in:</strong> {html.escape(row.interest or "-")}</p>
    <p><strong>Message:</strong></p>
    <p>{html.escape(row.message).replace(chr(10), "<br>")}</p>
    """
    _send(CONTACT_NOTIFICATION_EMAIL, f"New contact form message from {row.name}", html_body)

    return {"success": True}
