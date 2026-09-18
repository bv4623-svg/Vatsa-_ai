from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from app.database import Base


class UsageDaily(Base):
    """Per-user, per-feature, per-day usage counter backing the free/pro/
    business daily limits in app.services.feature_access. One row per
    (user, feature, date); incremented atomically at the SQL level."""
    __tablename__ = "usage_daily"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)
    count = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "feature", "date", name="uq_usage_daily_user_feature_date"),
    )
