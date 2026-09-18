import logging
from datetime import datetime

from app.database import SessionLocal
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger("SubscriptionExpiry")


def expire_subscriptions() -> int:
    """Each payment buys ACCESS_DAYS of a paid plan (see payment_service.py)
    and nothing renews automatically, so access must end when the days do.
    Downgrades every user who has paid before but has no verified
    subscription still inside its window, and marks lapsed rows "expired".

    Users with no verified subscription at all (comped or manually
    assigned accounts) are left alone -- this only ends access that a
    payment created. Returns the number of users downgraded."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        db.query(Subscription).filter(
            Subscription.status == "active", Subscription.expires_at <= now
        ).update({"status": "expired"}, synchronize_session=False)

        paying_user_ids = [
            row[0] for row in db.query(Subscription.user_id).filter(Subscription.verified.is_(True)).distinct()
        ]

        downgraded = 0
        for user_id in paying_user_ids:
            still_active = (
                db.query(Subscription.id)
                .filter(Subscription.user_id == user_id, Subscription.verified.is_(True), Subscription.expires_at > now)
                .first()
            )
            if still_active:
                continue
            user = db.get(User, user_id)
            if user and (user.tier or "free") != "free":
                user.tier = "free"
                downgraded += 1

        db.commit()
        if downgraded:
            logger.info("Downgraded %d user(s) whose paid access lapsed", downgraded)
        return downgraded
    finally:
        db.close()
