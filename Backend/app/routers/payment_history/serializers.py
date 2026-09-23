from typing import Any, Dict

from app.models.payment import Payment, PaymentEvent


def _iso(value) -> str | None:
    return f"{value.isoformat()}Z" if value else None  # stored as naive UTC


def _payment_dict(p: Payment) -> Dict[str, Any]:
    return {
        "id": p.id,
        "email": p.email,
        "razorpay_order_id": p.razorpay_order_id,
        "razorpay_payment_id": p.razorpay_payment_id,
        "amount": p.amount,
        "currency": p.currency,
        "plan": p.plan,
        "status": p.status,
        "created_at": _iso(p.created_at),
        "updated_at": _iso(p.updated_at),
    }


def _event_dict(e: PaymentEvent, p: Payment) -> Dict[str, Any]:
    return {
        "id": e.id,
        "payment_id": p.id,
        "razorpay_order_id": p.razorpay_order_id,
        "razorpay_payment_id": p.razorpay_payment_id,
        "event_type": e.event_type,
        "received_at": _iso(e.received_at),
    }
