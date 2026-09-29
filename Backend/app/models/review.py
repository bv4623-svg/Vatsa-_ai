from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint

from app.database import Base

REVIEW_STATUSES = ("pending", "approved", "rejected", "hidden")
VOTE_TYPES = ("helpful", "not_helpful")
REPORT_REASONS = ("spam", "offensive", "off_topic", "fake", "other")
REPORT_STATUSES = ("open", "resolved", "dismissed")
BAN_MODES = ("shadow", "full")
REVIEW_TAGS = ("quality", "speed", "price", "support", "coding", "images", "research", "ui")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Review(Base):
    """A user's review of Vatsa AI. Lists are JSON (not Postgres arrays) so the
    same schema runs on SQLite in tests and Postgres in production."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String(64), nullable=True)
    rating = Column(Integer, nullable=False, index=True)
    title = Column(String(200), nullable=True)
    body = Column(Text, nullable=False)
    body_fingerprint = Column(String(64), nullable=False, default="", index=True)
    pros = Column(JSON, nullable=False, default=list)
    cons = Column(JSON, nullable=False, default=list)
    tags = Column(JSON, nullable=False, default=list)
    media_urls = Column(JSON, nullable=False, default=list)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_public = Column(Boolean, nullable=False, default=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    moderation_note = Column(String(300), nullable=True)
    appeal_message = Column(String(1000), nullable=True)
    appealed_at = Column(DateTime, nullable=True)
    spam_score = Column(Float, nullable=False, default=0.0)
    helpful_count = Column(Integer, nullable=False, default=0)
    not_helpful_count = Column(Integer, nullable=False, default=0)
    helpful_score = Column(Float, nullable=False, default=0.0, index=True)
    report_count = Column(Integer, nullable=False, default=0)
    ai_summary = Column(Text, nullable=True)
    ai_sentiment = Column(String(20), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)


class ReviewVote(Base):
    __tablename__ = "review_votes"
    __table_args__ = (UniqueConstraint("review_id", "user_id", name="uq_review_vote"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vote_type = Column(String(12), nullable=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class ReviewReply(Base):
    __tablename__ = "review_replies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    is_owner = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class ReviewReport(Base):
    __tablename__ = "review_reports"
    __table_args__ = (UniqueConstraint("review_id", "reporter_id", name="uq_review_report"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(20), nullable=False)
    details = Column(String(1000), nullable=True)
    status = Column(String(20), nullable=False, default="open", index=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class WallPin(Base):
    __tablename__ = "wall_pins"
    __table_args__ = (UniqueConstraint("user_id", "review_id", name="uq_wall_pin"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    is_public = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class ReviewBan(Base):
    """Review-system ban. "shadow": the user's reviews stay visible only to
    them. "full": the account is also deactivated. Kept in its own table so
    no column is added to users (create_all can't alter existing tables)."""
    __tablename__ = "review_bans"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    mode = Column(String(10), nullable=False)
    reason = Column(String(300), nullable=True)
    banned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
