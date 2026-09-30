from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.auth.dependencies.admin import require_admin
from app.database import get_db
from app.models.review import REVIEW_STATUSES, Review, ReviewBan, ReviewReport
from app.models.user import User
from app.routers.reviews.common import is_admin_user, serialize
from app.routers.reviews.schemas import AdminStatus, AdminStatusUpdate, BanRequest
from app.utils.rate_limit import enforce_rate_limit

router = APIRouter()

_DEFAULT_NOTES = {
    "rejected": "A moderator decided this review doesn't meet the review guidelines.",
    "hidden": "A moderator hid this review.",
}


def _throttle(admin: User) -> None:
    enforce_rate_limit(f"admin-reviews:{admin.id}", limit=120, window_seconds=60)


@router.get("/api/admin/reviews")
def moderation_queue(
    status: Optional[AdminStatus] = "pending",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _throttle(admin)
    query = db.query(Review)
    if status:
        query = query.filter(Review.status == status)
    if status == "pending":
        # Most-reported first, then oldest first: a queue, not a feed.
        query = query.order_by(Review.report_count.desc(), Review.created_at.asc(), Review.id.asc())
    else:
        query = query.order_by(Review.created_at.desc(), Review.id.desc())
    rows = query.offset(offset).limit(limit).all()
    counts = {s: db.query(Review).filter(Review.status == s).count() for s in REVIEW_STATUSES}
    counts["open_reports"] = db.query(ReviewReport).filter(ReviewReport.status == "open").count()
    return {"items": serialize(db, rows, admin, admin=True), "total": query.count(), "counts": counts}


@router.patch("/api/admin/reviews/{review_id}/status")
def set_status(review_id: int, req: AdminStatusUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    _throttle(admin)
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Review not found")
    if req.status:
        review.status = req.status
        review.moderation_note = (req.note or "").strip() or _DEFAULT_NOTES.get(req.status)
        report_outcome = "dismissed" if req.status == "approved" else "resolved"
        db.query(ReviewReport).filter(ReviewReport.review_id == review.id, ReviewReport.status == "open").update(
            {ReviewReport.status: report_outcome}, synchronize_session=False
        )
    if req.featured is not None:
        review.is_featured = req.featured
    db.commit()
    db.refresh(review)
    return serialize(db, [review], admin, admin=True)[0]


def _target(db: Session, user_id: int, admin: User) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id or is_admin_user(user):
        raise HTTPException(400, "Admins can't be banned from here.")
    return user


@router.post("/api/admin/users/{user_id}/ban")
def ban_user(user_id: int, req: BanRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """shadow: their reviews stay visible only to them. full: also
    deactivates the account and signs it out everywhere."""
    _throttle(admin)
    user = _target(db, user_id, admin)
    ban = db.get(ReviewBan, user.id) or ReviewBan(user_id=user.id)
    ban.mode, ban.reason, ban.banned_by = req.mode, (req.reason or "").strip() or None, admin.id
    db.merge(ban)
    if req.mode == "full":
        user.is_active = False
        user.token_version = (user.token_version or 0) + 1
        db.query(Review).filter(Review.user_id == user.id, Review.status.in_(("approved", "pending"))).update(
            {Review.status: "hidden", Review.moderation_note: _DEFAULT_NOTES["hidden"]}, synchronize_session=False
        )
    db.commit()
    return {"user_id": user.id, "mode": req.mode}


@router.delete("/api/admin/users/{user_id}/ban", status_code=204)
def unban_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    _throttle(admin)
    user = _target(db, user_id, admin)
    ban = db.get(ReviewBan, user.id)
    if not ban:
        return Response(status_code=204)
    if ban.mode == "full":
        user.is_active = True
    # Reviews auto-published while shadow-banned never went through the
    # queue; send them there instead of making them public on unban.
    db.query(Review).filter(
        Review.user_id == user.id, Review.status == "approved", Review.created_at >= ban.created_at
    ).update({Review.status: "pending", Review.moderation_note: None}, synchronize_session=False)
    db.delete(ban)
    db.commit()
    return Response(status_code=204)
