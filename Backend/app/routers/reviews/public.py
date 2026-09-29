import os
import time
from collections import Counter
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.database import get_db
from app.models.review import REVIEW_TAGS, Review, WallPin, _utcnow
from app.models.user import User
from app.routers.reviews.common import (
    apply_cursor,
    display_name,
    encode_cursor,
    get_review_or_404,
    is_admin_user,
    serialize,
    visible_reviews,
)
from app.routers.reviews.schemas import ReviewSort

router = APIRouter()

SUMMARY_TTL_SECONDS = 600
_summary_cache: dict = {}


def _filtered(
    db: Session,
    rating: Optional[int],
    tag: Optional[str],
    verified: Optional[bool],
    days: Optional[int],
    q: Optional[str],
):
    query = visible_reviews(db)
    if rating:
        query = query.filter(Review.rating == rating)
    if tag:
        # Tags come from a fixed list, so matching the JSON text is exact and safe.
        query = query.filter(cast(Review.tags, String).like(f'%"{tag}"%'))
    if verified is not None:
        query = query.filter(Review.is_verified.is_(verified))
    if days:
        query = query.filter(Review.created_at >= _utcnow() - timedelta(days=days))
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(or_(func.lower(Review.body).like(needle), func.lower(func.coalesce(Review.title, "")).like(needle)))
    return query


def _page(db, query, sort, cursor, limit, viewer):
    rows = apply_cursor(query, sort, cursor).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": serialize(db, rows, viewer),
        "next_cursor": encode_cursor(sort, rows[-1]) if has_more and rows else None,
    }


def _stats(db: Session) -> dict:
    rows = visible_reviews(db).with_entities(Review.rating, Review.ai_sentiment).all()
    distribution = {str(n): 0 for n in range(1, 6)}
    sentiments = Counter()
    for rating, mood in rows:
        distribution[str(rating)] += 1
        sentiments[mood or "neutral"] += 1
    total = len(rows)
    return {
        "count": total,
        "average": round(sum(int(k) * v for k, v in distribution.items()) / total, 1) if total else None,
        "distribution": distribution,
        "sentiment": {s: sentiments.get(s, 0) for s in ("positive", "neutral", "negative")},
    }


def _list_params(
    rating: Optional[int] = Query(None, ge=1, le=5),
    tag: Optional[str] = Query(None),
    verified: Optional[bool] = None,
    days: Optional[int] = Query(None, ge=1, le=3650),
    q: Optional[str] = Query(None, max_length=100),
    sort: ReviewSort = "recent",
    cursor: Optional[str] = Query(None, max_length=500),
    limit: int = Query(12, ge=1, le=50),
):
    if tag and tag not in REVIEW_TAGS:
        raise HTTPException(422, f"Unknown tag. Allowed: {', '.join(REVIEW_TAGS)}.")
    return dict(rating=rating, tag=tag, verified=verified, days=days, q=q, sort=sort, cursor=cursor, limit=limit)


@router.get("/api/reviews")
def list_reviews(
    params: dict = Depends(_list_params),
    viewer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = _filtered(db, params["rating"], params["tag"], params["verified"], params["days"], params["q"])
    return _page(db, query, params["sort"], params["cursor"], params["limit"], viewer)


@router.get("/api/wall/public")
def public_wall(
    params: dict = Depends(_list_params),
    viewer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """The reviews wall: one page of reviews plus, on the first page, the
    admin-featured reviews and the rating breakdown."""
    query = _filtered(db, params["rating"], params["tag"], params["verified"], params["days"], params["q"])
    page = _page(db, query, params["sort"], params["cursor"], params["limit"], viewer)
    if not params["cursor"]:
        featured = visible_reviews(db).filter(Review.is_featured.is_(True)).order_by(Review.created_at.desc()).limit(6).all()
        page["featured"] = serialize(db, featured, viewer)
        page["stats"] = _stats(db)
    return page


def _themes(rows, attr: str, top: int = 3):
    counts: Counter = Counter()
    labels = {}
    for r in rows:
        for point in getattr(r, attr) or []:
            key = point.strip().lower()
            counts[key] += 1
            labels.setdefault(key, point.strip())
    return [{"text": labels[k], "count": n} for k, n in counts.most_common(top)]


def _stats_sentence(stats: dict, tags, pros, cons) -> str:
    parts = [f"Based on {stats['count']} review{'s' if stats['count'] != 1 else ''}, the average rating is {stats['average']} out of 5."]
    if tags:
        parts.append("People most often mention " + " and ".join(t["tag"] for t in tags[:2]) + ".")
    if pros:
        parts.append(f"Most-cited strength: \"{pros[0]['text']}\".")
    if cons:
        parts.append(f"Most-cited complaint: \"{cons[0]['text']}\".")
    return " ".join(parts)


async def _llm_sentence(rows) -> Optional[str]:
    if not os.getenv("OPENROUTER_API_KEY"):
        return None
    from app.services.ai_service import AIService

    sample = "\n".join(f"- {r.rating}/5: {r.body[:400]}" for r in rows[:40])
    try:
        result = await AIService.call_openrouter(
            [
                {"role": "system", "content": "Summarize product reviews in 2-3 plain sentences: the main praise, the main complaints, and the overall mood. Only use what the reviews say. No preamble."},
                {"role": "user", "content": sample},
            ],
            model=AIService.map_model("vatsa-fast"),
            max_tokens=200,
            temperature=0.2,
        )
    except Exception:
        return None
    text = (result.get("content") or "").strip()
    return text[:1200] or None


@router.get("/api/reviews/summary")
async def reviews_summary(db: Session = Depends(get_db)):
    """AISummaryCard data. The numbers always come from the database; the
    written summary comes from the LLM when a key is configured (cached for
    10 minutes), otherwise it is built from those numbers."""
    rows = visible_reviews(db).order_by(Review.created_at.desc()).limit(500).all()
    stats = _stats(db)
    tag_counts = Counter(t for r in rows for t in (r.tags or []))
    tags = [{"tag": t, "count": n} for t, n in tag_counts.most_common(5)]
    pros, cons = _themes(rows, "pros"), _themes(rows, "cons")
    result = {"stats": stats, "top_tags": tags, "top_pros": pros, "top_cons": cons, "text": None, "generated_by": None}
    if not rows:
        return result

    key = (len(rows), max(r.updated_at for r in rows).isoformat())
    cached = _summary_cache.get("summary")
    if cached and cached[0] == key and time.monotonic() - cached[1] < SUMMARY_TTL_SECONDS:
        text, source = cached[2], cached[3]
    else:
        text = await _llm_sentence(rows) if len(rows) >= 3 else None
        source = "ai" if text else "stats"
        text = text or _stats_sentence(stats, tags, pros, cons)
        _summary_cache["summary"] = (key, time.monotonic(), text, source)
    result.update(text=text, generated_by=source)
    return result


@router.get("/api/reviews/mine")
def my_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every review I wrote, in any state, so I can see why one is pending,
    rejected or hidden and appeal it."""
    rows = db.query(Review).filter(Review.user_id == user.id).order_by(Review.created_at.desc()).all()
    return {"items": serialize(db, rows, user)}


@router.get("/api/wall/me")
def my_wall(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pins = db.query(WallPin).filter(WallPin.user_id == user.id).order_by(WallPin.position, WallPin.created_at).all()
    ids = [p.review_id for p in pins]
    visible = {r.id: r for r in visible_reviews(db).filter(Review.id.in_(ids))} if ids else {}
    by_id = {item["id"]: item for item in serialize(db, visible.values(), user)}
    return {
        "items": [
            {"review_id": p.review_id, "is_public": p.is_public, "position": p.position, "review": by_id.get(p.review_id)}
            for p in pins
        ],
    }


@router.get("/api/users/{user_id}/wall")
def user_wall(user_id: int, viewer: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    owner = db.get(User, user_id)
    if not owner or not owner.is_active or owner.is_deleted:
        raise HTTPException(404, "User not found")
    pins = (
        db.query(WallPin)
        .filter(WallPin.user_id == user_id, WallPin.is_public.is_(True))
        .order_by(WallPin.position, WallPin.created_at)
        .all()
    )
    ids = [p.review_id for p in pins]
    visible = {r.id: r for r in visible_reviews(db).filter(Review.id.in_(ids))} if ids else {}
    by_id = {item["id"]: item for item in serialize(db, visible.values(), viewer)}
    return {
        "user": {"id": owner.id, "name": display_name(owner)},
        "items": [by_id[p.review_id] for p in pins if p.review_id in by_id],
    }


@router.get("/api/reviews/{review_id}")
def get_review(review_id: int, viewer: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    review = get_review_or_404(db, review_id, viewer)
    return serialize(db, [review], viewer, admin=is_admin_user(viewer))[0]


@router.get("/api/reviews/{review_id}/similar")
def similar_reviews(
    review_id: int,
    limit: int = Query(3, ge=1, le=10),
    viewer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """PRD "similar reviews": TF-IDF cosine similarity (scikit-learn is
    already a dependency), so no vector database is needed for v1."""
    review = get_review_or_404(db, review_id, viewer)
    pool = visible_reviews(db).filter(Review.id != review.id).order_by(Review.created_at.desc()).limit(500).all()
    if not pool:
        return {"items": []}
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    docs = [f"{r.title or ''} {r.body}" for r in pool]
    try:
        matrix = TfidfVectorizer(stop_words="english").fit_transform([f"{review.title or ''} {review.body}"] + docs)
    except ValueError:  # every word was a stop word
        return {"items": []}
    scores = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
    ranked = [pool[i] for i in scores.argsort()[::-1] if scores[i] > 0.05][:limit]
    return {"items": serialize(db, ranked, viewer)}
