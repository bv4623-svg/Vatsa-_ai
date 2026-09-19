"""Writes to the payments / payment_events ledger.

Every helper here adds to the caller's session and never commits: the caller
commits the ledger change and the matching Subscription / User change in one
transaction, so the two can never disagree.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentEvent
from app.models.subscription import Subscription
from app.models.user import User

CREATED = "created"
CAPTURED = "captured"
FAILED = "failed"
REFUNDED = "refunded"

# A payment only moves forward. A late bad-signature call must never turn a
# captured payment into a failed one, and a refunded payment stays refunded.
_RANK = {CREATED: 0, FAILED: 1, CAPTURED: 2, REFUNDED: 3}

# Never stored: card and UPI identifiers (this app does not keep card data)
# and the HMAC signature (kept only in its own column).
_SENSITIVE_KEYS = {"card", "card_id", "token_id", "vpa", "razorpay_signature", "signature"}


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items() if k not in _SENSITIVE_KEYS}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def advance_status(payment: Payment, new_status: str) -> None:
    if _RANK[new_status] >= _RANK.get(payment.status or CREATED, 0):
        payment.status = new_status


def merge_raw(payment: Payment, key: str, value: Any) -> None:
    """Keeps every payload under its own key (order, verify, webhook
    events); reassigns the dict so the JSON column change is detected."""
    merged = dict(payment.raw_payload or {})
    merged[key] = redact(value)
    payment.raw_payload = merged


def add_event(
    db: Session,
    payment: Optional[Payment],
    event_type: str,
    payload: Dict[str, Any],
    razorpay_event_id: Optional[str] = None,
) -> PaymentEvent:
    event = PaymentEvent(
        payment_id=payment.id if payment is not None else None,
        event_type=event_type,
        razorpay_event_id=razorpay_event_id,
        payload=redact(payload),
        received_at=datetime.utcnow(),
    )
    db.add(event)
    return event


def ledger_for_order(db: Session, order_id: str) -> Optional[Payment]:
    return db.query(Payment).filter(Payment.razorpay_order_id == order_id).first()


def ledger_for_payment(db: Session, payment_id: str) -> Optional[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.razorpay_payment_id == payment_id, Payment.status.in_([CAPTURED, REFUNDED]))
        .first()
    )


def ledger_for_subscription(db: Session, user: User, sub: Subscription) -> Payment:
    """The ledger row for an order that already has a Subscription. An order
    created before the ledger existed has none yet; it is built from that
    Subscription's own recorded values, never from anything the caller sent."""
    existing = ledger_for_order(db, sub.order_id)
    if existing is not None:
        return existing

    payment = Payment(
        user_id=user.id,
        email=user.email,
        razorpay_order_id=sub.order_id,
        amount=int(round(float(sub.amount or 0) * 100)),
        currency=(sub.currency or "USD").upper(),
        plan=sub.plan,
        status=CREATED,
        raw_payload={},
        created_at=sub.created_at or datetime.utcnow(),
    )
    db.add(payment)
    db.flush()
    return payment
