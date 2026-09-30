import base64
import hashlib
import json
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from fastapi import HTTPException
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Query, Session

from app.auth.dependencies.admin import admin_emails
from app.models.review import Review, ReviewBan, ReviewReply, ReviewReport, ReviewVote, WallPin
from app.models.usage_daily import UsageDaily
from app.models.user import User
from app.services.feature_access import user_tier
from app.services.review_moderation import normalize

VERIFIED_MESSAGE_THRESHOLD = 10
SORT_KEYS = {
    "recent": (Review.created_at, Review.id),
    "top": (Review.rating, Review.created_at, Review.id),
    "helpful": (Review.helpful_score, Review.created_at, Review.id),
}


def fingerprint(text: str) -> str:
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()


def is_admin_user(user: Optional[User]) -> bool:
    """Same bar as require_admin, without raising: used to mark replies as
    the owner's and to let admins see any review."""
    return bool(
        user
        and user.is_verified
        and user.two_factor_enabled
        and (user.email or "").strip().lower() in admin_emails()
    )


def ban_for(db: Session, user_id: int) -> Optional[ReviewBan]:
    return db.get(ReviewBan, user_id)


def is_verified_reviewer(db: Session, user: User) -> bool:
    """PRD "verified" badge: a paying customer, or someone who has really
    used the product (sent at least 10 chat/code messages)."""
    if user_tier(user) != "free":
        return True
    sent = (
        db.query(func.coalesce(func.sum(UsageDaily.count), 0))
        .filter(UsageDaily.user_id == user.id, UsageDaily.feature.in_(("chat_messages", "code_messages")))
        .scalar()
    )
    return int(sent or 0) >= VERIFIED_MESSAGE_THRESHOLD


def is_trusted(db: Session, user: User) -> bool:
    """Auto-publish without the queue: admins, or a verified email + verified
    reviewer with no review ever rejected or hidden, and not banned."""
    if is_admin_user(user):
        return True
    if not user.is_verified or ban_for(db, user.id):
        return False
    bad = db.query(Review.id).filter(Review.user_id == user.id, Review.status.in_(("rejected", "hidden"))).first()
    return bad is None and is_verified_reviewer(db, user)


def visible_reviews(db: Session) -> Query:
    """Reviews anyone may see: approved, public, author active and not banned."""
    banned = select(ReviewBan.user_id)
    return (
        db.query(Review)
        .join(User, User.id == Review.user_id)
        .filter(
            Review.status == "approved",
            Review.is_public.is_(True),
            User.is_active.is_(True),
            User.is_deleted.is_(False),
            Review.user_id.not_in(banned),
        )
    )


def is_visible(db: Session, review: Review) -> bool:
    return visible_reviews(db).filter(Review.id == review.id).first() is not None


def can_view(db: Session, review: Review, viewer: Optional[User]) -> bool:
    if viewer and (viewer.id == review.user_id or is_admin_user(viewer)):
        return True
    return is_visible(db, review)


def get_review_or_404(db: Session, review_id: int, viewer: Optional[User]) -> Review:
    review = db.get(Review, review_id)
    if not review or not can_view(db, review, viewer):
        raise HTTPException(404, "Review not found")
    return review


def display_name(user: Optional[User]) -> str:
    """First name + last initial: enough to feel human on a public wall
    without publishing anyone's full name or email."""
    if not user:
        return "Vatsa AI user"
    parts = (user.full_name or "").split()
    if parts:
        return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0].upper()}."
    return user.username or "Vatsa AI user"


def encode_cursor(sort: str, review: Review) -> str:
    values = [getattr(review, col.key) for col in SORT_KEYS[sort]]
    raw = [v.isoformat() if isinstance(v, datetime) else v for v in values]
    return base64.urlsafe_b64encode(json.dumps([sort, raw]).encode()).decode().rstrip("=")


def apply_cursor(query: Query, sort: str, cursor: Optional[str]) -> Query:
    columns = SORT_KEYS[sort]
    if cursor:
        try:
            padded = cursor + "=" * (-len(cursor) % 4)
            cursor_sort, raw = json.loads(base64.urlsafe_b64decode(padded.encode()))
            if cursor_sort != sort or len(raw) != len(columns):
                raise ValueError
            values = [
                datetime.fromisoformat(v) if col.key == "created_at" else v
                for col, v in zip(columns, raw)
            ]
        except (ValueError, TypeError, json.JSONDecodeError):
            raise HTTPException(400, "Invalid cursor")
        query = query.filter(tuple_(*columns) < tuple_(*values))
    return query.order_by(*[c.desc() for c in columns])


def serialize(
    db: Session,
    reviews: Iterable[Review],
    viewer: Optional[User] = None,
    *,
    admin: bool = False,
) -> List[dict]:
    """Batch-loads authors, replies, the viewer's votes and pins for a page
    of reviews (no per-row queries)."""
    reviews = list(reviews)
    if not reviews:
        return []
    ids = [r.id for r in reviews]
    replies: Dict[int, List[ReviewReply]] = {}
    for reply in db.query(ReviewReply).filter(ReviewReply.review_id.in_(ids)).order_by(ReviewReply.created_at, ReviewReply.id):
        replies.setdefault(reply.review_id, []).append(reply)
    user_ids = {r.user_id for r in reviews} | {rep.user_id for reps in replies.values() for rep in reps if rep.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids))}

    my_votes: Dict[int, str] = {}
    my_pins: Dict[int, WallPin] = {}
    if viewer:
        my_votes = {v.review_id: v.vote_type for v in db.query(ReviewVote).filter(ReviewVote.user_id == viewer.id, ReviewVote.review_id.in_(ids))}
        my_pins = {p.review_id: p for p in db.query(WallPin).filter(WallPin.user_id == viewer.id, WallPin.review_id.in_(ids))}

    open_reports: Dict[int, List[ReviewReport]] = {}
    bans: Dict[int, str] = {}
    if admin:
        bans = {b.user_id: b.mode for b in db.query(ReviewBan).filter(ReviewBan.user_id.in_(user_ids))}
        for rep in db.query(ReviewReport).filter(ReviewReport.review_id.in_(ids), ReviewReport.status == "open"):
            open_reports.setdefault(rep.review_id, []).append(rep)

    out = []
    for r in reviews:
        mine = bool(viewer and viewer.id == r.user_id)
        item = {
            "id": r.id,
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "pros": r.pros or [],
            "cons": r.cons or [],
            "tags": r.tags or [],
            "is_verified": r.is_verified,
            "is_featured": r.is_featured,
            "is_public": r.is_public,
            "sentiment": r.ai_sentiment,
            "helpful_count": r.helpful_count,
            "not_helpful_count": r.not_helpful_count,
            "created_at": r.created_at.isoformat() + "Z",
            "edited": bool(r.updated_at and (r.updated_at - r.created_at).total_seconds() > 60),
            "author": {"id": r.user_id, "name": display_name(users.get(r.user_id))},
            "replies": [
                {
                    "id": rep.id,
                    "body": rep.body,
                    "is_owner": rep.is_owner,
                    "author_name": "Vatsa AI team" if rep.is_owner else display_name(users.get(rep.user_id)),
                    "created_at": rep.created_at.isoformat() + "Z",
                }
                for rep in replies.get(r.id, [])
            ],
            "is_mine": mine,
            "my_vote": my_votes.get(r.id),
            "pinned": r.id in my_pins,
        }
        if mine or admin:
            item.update(status=r.status, moderation_note=r.moderation_note, appealed=r.appealed_at is not None)
        if admin:
            author = users.get(r.user_id)
            item.update(
                author_email=author.email if author else None,
                spam_score=r.spam_score,
                report_count=r.report_count,
                appeal_message=r.appeal_message,
                open_reports=[
                    {"id": rep.id, "reason": rep.reason, "details": rep.details, "created_at": rep.created_at.isoformat() + "Z"}
                    for rep in open_reports.get(r.id, [])
                ],
                banned=bans.get(r.user_id),
            )
        out.append(item)
    return out
