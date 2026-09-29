from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.conversation import Conversation
from app.models.review import Review, ReviewReply, ReviewReport, ReviewVote, WallPin, _utcnow
from app.models.user import User
from app.routers.reviews.common import (
    ban_for,
    fingerprint,
    get_review_or_404,
    is_admin_user,
    is_trusted,
    is_verified_reviewer,
    is_visible,
    serialize,
)
from app.routers.reviews.schemas import (
    AppealRequest,
    PinOrder,
    PinRequest,
    ReplyRequest,
    ReportRequest,
    ReviewCreate,
    ReviewUpdate,
    VoteRequest,
)
from app.services.review_moderation import moderate, wilson_lower_bound
from app.utils.rate_limit import enforce_rate_limit

router = APIRouter()

DAILY_REVIEW_LIMIT = 3
REPORTS_TO_REQUEUE = 3


def _apply_moderation(db: Session, review: Review, user: User, chosen_tags) -> None:
    text = f"{review.title or ''}\n{review.body}\n" + "\n".join((review.pros or []) + (review.cons or []))
    review.body_fingerprint = fingerprint(review.body)
    duplicate = (
        db.query(Review.id)
        .filter(Review.body_fingerprint == review.body_fingerprint, Review.user_id != user.id)
        .first()
        is not None
    )
    verdict = moderate(rating=review.rating, text=text, chosen_tags=chosen_tags, duplicate=duplicate, trusted=is_trusted(db, user))
    status = verdict.status
    # Shadow ban: the author sees their review as published; nobody else
    # ever does (visible_reviews excludes banned authors).
    if status != "rejected" and ban_for(db, user.id):
        status = "approved"
    review.status = status
    review.spam_score = verdict.spam_score
    review.ai_sentiment = verdict.sentiment
    review.tags = verdict.tags
    review.moderation_note = verdict.note


def _own_review(db: Session, review_id: int, user: User) -> Review:
    review = db.get(Review, review_id)
    if not review or review.user_id != user.id:
        raise HTTPException(404, "Review not found")
    return review


@router.post("/api/reviews", status_code=201)
def create_review(req: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    since = _utcnow() - timedelta(days=1)
    if db.query(Review).filter(Review.user_id == user.id, Review.created_at >= since).count() >= DAILY_REVIEW_LIMIT:
        raise HTTPException(429, f"You can post up to {DAILY_REVIEW_LIMIT} reviews a day.")
    if req.conversation_id:
        conv = db.get(Conversation, req.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(404, "Conversation not found")
    if db.query(Review.id).filter(Review.user_id == user.id, Review.body_fingerprint == fingerprint(req.body)).first():
        raise HTTPException(409, "You've already posted this review.")

    review = Review(
        user_id=user.id,
        conversation_id=req.conversation_id,
        rating=req.rating,
        title=req.title,
        body=req.body,
        pros=req.pros,
        cons=req.cons,
        tags=[],
        is_public=req.is_public,
        is_verified=is_verified_reviewer(db, user),
    )
    _apply_moderation(db, review, user, req.tags)
    db.add(review)
    db.commit()
    db.refresh(review)
    return serialize(db, [review], user)[0]


@router.patch("/api/reviews/{review_id}")
def update_review(review_id: int, req: ReviewUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    review = _own_review(db, review_id, user)
    if review.status in ("rejected", "hidden"):
        raise HTTPException(409, "This review was taken down. Appeal the decision instead of editing it.")
    review.rating, review.title, review.body = req.rating, req.title, req.body
    review.pros, review.cons, review.is_public = req.pros, req.cons, req.is_public
    _apply_moderation(db, review, user, req.tags)
    review.updated_at = _utcnow()
    db.commit()
    db.refresh(review)
    return serialize(db, [review], user)[0]


@router.delete("/api/reviews/{review_id}", status_code=204)
def delete_review(review_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    review = db.get(Review, review_id)
    if not review or (review.user_id != user.id and not is_admin_user(user)):
        raise HTTPException(404, "Review not found")
    # Explicit: SQLite runs without PRAGMA foreign_keys, so ON DELETE CASCADE
    # only fires on Postgres.
    for child in (ReviewVote, ReviewReply, ReviewReport, WallPin):
        db.query(child).filter(child.review_id == review.id).delete()
    db.delete(review)
    db.commit()
    return Response(status_code=204)


def _public_or_404(db: Session, review_id: int) -> Review:
    review = db.get(Review, review_id)
    if not review or not is_visible(db, review):
        raise HTTPException(404, "Review not found")
    return review


@router.post("/api/reviews/{review_id}/vote")
def vote(review_id: int, req: VoteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(f"review-vote:{user.id}", limit=60, window_seconds=60)
    review = _public_or_404(db, review_id)
    if review.user_id == user.id:
        raise HTTPException(400, "You can't vote on your own review.")
    existing = db.query(ReviewVote).filter(ReviewVote.review_id == review.id, ReviewVote.user_id == user.id).first()
    if existing and existing.vote_type == req.vote_type:
        db.delete(existing)
        my_vote = None
    elif existing:
        existing.vote_type = req.vote_type
        my_vote = req.vote_type
    else:
        db.add(ReviewVote(review_id=review.id, user_id=user.id, vote_type=req.vote_type))
        my_vote = req.vote_type
    db.flush()
    counts = dict(
        db.query(ReviewVote.vote_type, func.count(ReviewVote.id))
        .filter(ReviewVote.review_id == review.id)
        .group_by(ReviewVote.vote_type)
        .all()
    )
    review.helpful_count = counts.get("helpful", 0)
    review.not_helpful_count = counts.get("not_helpful", 0)
    review.helpful_score = wilson_lower_bound(review.helpful_count, review.not_helpful_count)
    db.commit()
    return {"helpful_count": review.helpful_count, "not_helpful_count": review.not_helpful_count, "my_vote": my_vote}


@router.post("/api/reviews/{review_id}/report", status_code=201)
def report(review_id: int, req: ReportRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(f"review-report:{user.id}", limit=20, window_seconds=3600)
    review = _public_or_404(db, review_id)
    if review.user_id == user.id:
        raise HTTPException(400, "You can't report your own review.")
    if db.query(ReviewReport.id).filter(ReviewReport.review_id == review.id, ReviewReport.reporter_id == user.id).first():
        raise HTTPException(409, "You've already reported this review.")
    db.add(ReviewReport(review_id=review.id, reporter_id=user.id, reason=req.reason, details=(req.details or "").strip() or None))
    review.report_count += 1
    author = db.get(User, review.user_id)
    # Several independent reports pull a review back into the queue until a
    # moderator looks, unless its author is trusted.
    if review.report_count >= REPORTS_TO_REQUEUE and review.status == "approved" and not (author and is_trusted(db, author)):
        review.status = "pending"
        review.moderation_note = "Your review is being re-checked after reports from other users."
    db.commit()
    return {"reported": True}


@router.post("/api/reviews/{review_id}/reply", status_code=201)
def reply(review_id: int, req: ReplyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce_rate_limit(f"review-reply:{user.id}", limit=30, window_seconds=3600)
    review = get_review_or_404(db, review_id, user)
    owner = is_admin_user(user)
    # Replies are a thread between the Vatsa AI team and the reviewer, not
    # an open comment section.
    if not owner and review.user_id != user.id:
        raise HTTPException(403, "Only the Vatsa AI team and the review's author can reply.")
    db.add(ReviewReply(review_id=review.id, user_id=user.id, body=req.body, is_owner=owner))
    db.commit()
    return serialize(db, [review], user, admin=owner)[0]


@router.post("/api/reviews/{review_id}/appeal")
def appeal(review_id: int, req: AppealRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    review = _own_review(db, review_id, user)
    if review.status not in ("rejected", "hidden"):
        raise HTTPException(409, "Only a rejected or hidden review can be appealed.")
    if review.appealed_at:
        raise HTTPException(409, "You've already appealed this decision.")
    review.appeal_message = req.message
    review.appealed_at = _utcnow()
    review.status = "pending"
    review.moderation_note = "Your appeal is waiting for a moderator."
    db.commit()
    return serialize(db, [review], user)[0]


@router.post("/api/reviews/{review_id}/pin")
def pin(review_id: int, req: Optional[PinRequest] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = req or PinRequest()
    review = _public_or_404(db, review_id)
    existing = db.query(WallPin).filter(WallPin.user_id == user.id, WallPin.review_id == review.id).first()
    if existing:
        existing.is_public = req.is_public
    else:
        top = db.query(func.max(WallPin.position)).filter(WallPin.user_id == user.id).scalar()
        db.add(WallPin(user_id=user.id, review_id=review.id, is_public=req.is_public, position=(top if top is not None else -1) + 1))
    db.commit()
    return {"pinned": True, "is_public": req.is_public}


@router.delete("/api/reviews/{review_id}/pin", status_code=204)
def unpin(review_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(WallPin).filter(WallPin.user_id == user.id, WallPin.review_id == review_id).delete()
    db.commit()
    return Response(status_code=204)


@router.put("/api/wall/me/order")
def reorder_pins(req: PinOrder, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pins = {p.review_id: p for p in db.query(WallPin).filter(WallPin.user_id == user.id)}
    unknown = [rid for rid in req.review_ids if rid not in pins]
    if unknown or len(set(req.review_ids)) != len(req.review_ids):
        raise HTTPException(400, "The order must list each of your pinned reviews at most once.")
    ordered = req.review_ids + [rid for rid in sorted(pins, key=lambda r: pins[r].position) if rid not in req.review_ids]
    for position, rid in enumerate(ordered):
        pins[rid].position = position
    db.commit()
    return {"review_ids": ordered}
