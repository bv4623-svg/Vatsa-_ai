from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user_optional
from app.auth.dependencies.admin import require_admin
from app.database import get_db
from app.models.feedback import FEEDBACK_STATUSES, Feedback, _utcnow
from app.models.user import User
from app.utils.rate_limit import client_ip, enforce_rate_limit

router = APIRouter(tags=["feedback"])

DAILY_LIMIT = 5
MESSAGE_MIN, MESSAGE_MAX = 10, 5000

FeedbackType = Literal["bug", "feature", "praise", "other"]
FeedbackStatus = Literal["new", "read", "resolved"]


class FeedbackCreate(BaseModel):
    type: FeedbackType
    message: str
    rating: Optional[int] = Field(None, ge=1, le=5)
    email: Optional[EmailStr] = None
    page_url: Optional[str] = Field(None, max_length=2048)

    @field_validator("message")
    @classmethod
    def _message_length(cls, value: str) -> str:
        value = value.strip()
        if not MESSAGE_MIN <= len(value) <= MESSAGE_MAX:
            raise ValueError(f"Message must be between {MESSAGE_MIN} and {MESSAGE_MAX} characters.")
        return value

    @field_validator("page_url")
    @classmethod
    def _page_url(cls, value: Optional[str]) -> Optional[str]:
        # Shown as a link in the admin list, so only web URLs and in-app paths.
        if value and not value.startswith(("https://", "http://", "/")):
            raise ValueError("page_url must be an http(s) URL or a path.")
        return value or None


class FeedbackUpdate(BaseModel):
    status: FeedbackStatus


@router.post("/api/feedback", status_code=201)
def submit_feedback(
    req: FeedbackCreate,
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if user:
        since = _utcnow() - timedelta(days=1)
        sent_today = db.query(Feedback).filter(Feedback.user_id == user.id, Feedback.created_at >= since).count()
        if sent_today >= DAILY_LIMIT:
            raise HTTPException(429, f"You can send up to {DAILY_LIMIT} feedback messages a day. Thanks for all of them!")
    else:
        enforce_rate_limit(f"feedback:ip:{client_ip(request)}", limit=DAILY_LIMIT, window_seconds=86400)

    row = Feedback(
        user_id=user.id if user else None,
        email=user.email if user else (str(req.email) if req.email else None),
        type=req.type,
        message=req.message,
        rating=req.rating,
        page_url=req.page_url,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        status="new",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status}


@router.get("/api/feedback")
def list_feedback(
    status: Optional[FeedbackStatus] = None,
    type: Optional[FeedbackType] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"admin-feedback:{admin.id}", limit=60, window_seconds=60)
    query = db.query(Feedback)
    if status:
        query = query.filter(Feedback.status == status)
    if type:
        query = query.filter(Feedback.type == type)
    rows = query.order_by(Feedback.created_at.desc(), Feedback.id.desc()).offset(offset).limit(limit).all()
    counts = {s: db.query(Feedback).filter(Feedback.status == s).count() for s in FEEDBACK_STATUSES}
    return {"items": [r.to_dict() for r in rows], "total": query.count(), "limit": limit, "offset": offset, "counts": counts}


@router.patch("/api/feedback/{feedback_id}")
def update_feedback(
    feedback_id: int,
    req: FeedbackUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"admin-feedback:{admin.id}", limit=60, window_seconds=60)
    row = db.get(Feedback, feedback_id)
    if not row:
        raise HTTPException(404, "Feedback not found")
    row.status = req.status
    db.commit()
    return row.to_dict()
