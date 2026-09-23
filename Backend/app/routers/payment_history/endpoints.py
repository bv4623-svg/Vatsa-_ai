from typing import Any, Dict, List

from fastapi import Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.dependencies.admin import require_admin
from app.database import get_db
from app.models.payment import Payment, PaymentEvent
from app.models.user import User
from app.utils.rate_limit import enforce_rate_limit

from app.routers.payment_history.serializers import _iso, _payment_dict, _event_dict
from app.routers.payment_history.router import router, logger


@router.get("/api/payments/me")
def my_payments(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The signed-in user's own payments, newest first. Ownership is part of
    the query itself, so no other user's row can ever come back."""
    query = db.query(Payment).filter(Payment.user_id == current_user.id)
    rows = query.order_by(Payment.created_at.desc(), Payment.id.desc()).offset(offset).limit(limit).all()
    return {"items": [_payment_dict(p) for p in rows], "total": query.count(), "limit": limit, "offset": offset}


@router.get("/api/payments/me/events")
def my_payment_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Webhook and verification history for the signed-in user's own
    payments, newest first. Events about orders we have no record of belong
    to nobody and are never returned here."""
    query = (
        db.query(PaymentEvent, Payment)
        .join(Payment, PaymentEvent.payment_id == Payment.id)
        .filter(Payment.user_id == current_user.id)
    )
    rows = query.order_by(PaymentEvent.received_at.desc(), PaymentEvent.id.desc()).offset(offset).limit(limit).all()
    return {"items": [_event_dict(e, p) for e, p in rows], "total": query.count(), "limit": limit, "offset": offset}


@router.get("/api/admin/payments")
def admin_payments_by_email(
    email: str = Query(..., min_length=3, max_length=254),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Payments for one email address, for support. Exact match, never a
    pattern, and an email is required: this cannot list everyone. Matches the
    address recorded on the payment at the time (which survives the user
    changing it) and the address currently on the account."""
    enforce_rate_limit(f"admin-payments:{admin.id}", limit=30, window_seconds=60)

    wanted = email.strip().lower()
    account_ids = [row[0] for row in db.query(User.id).filter(func.lower(User.email) == wanted).all()]
    match = func.lower(Payment.email) == wanted
    if account_ids:
        match = match | Payment.user_id.in_(account_ids)

    query = db.query(Payment).filter(match)
    rows = query.order_by(Payment.created_at.desc(), Payment.id.desc()).offset(offset).limit(limit).all()

    items: List[Dict[str, Any]] = []
    for p in rows:
        item = _payment_dict(p)
        item["user_id"] = p.user_id
        item["events"] = [
            {"event_type": e.event_type, "received_at": _iso(e.received_at)} for e in p.events
        ]
        items.append(item)

    # Who looked is logged; whose address they looked up is not.
    logger.info("Admin %s looked up payments (%d results)", admin.id, len(items))
    return {"items": items, "total": query.count(), "limit": limit, "offset": offset}
