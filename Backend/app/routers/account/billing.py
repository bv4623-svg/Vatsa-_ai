from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.auth.dependencies import get_current_user

router = APIRouter()


@router.get("/api/account/billing")
def get_billing(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Real payment/subscription history from this account's own
    Subscription rows (Razorpay-verified, see app/services/payment_service.py)
    -- there is no hosted self-service billing portal in this app (no
    portal-capable processor is integrated), so this is a real invoice
    list rather than a fabricated "Manage billing" link."""
    rows = db.query(Subscription).filter(Subscription.user_id == user.id).order_by(Subscription.created_at.desc()).all()
    return {"tier": user.tier or "free", "invoices": [r.to_dict() for r in rows]}
