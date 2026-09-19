import os
import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.auth.dependencies import get_current_user
from app.services.feature_access import user_tier
from app.services.payment_service import (
    PaymentService, PaymentNotConfigured, PaymentProviderError,
)

logger = logging.getLogger("PaymentWebhook")

router = APIRouter(tags=["payment"])


class CreateOrderRequest(BaseModel):
    plan_id: str = "pro"
    currency: str = "USD"


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.get("/payment/plans")
@router.get("/api/payment/plans")
def get_plans():
    return {"plans": PaymentService.get_plans()}


def _missing_payment_keys() -> list[str]:
    """Env vars that must be set before a real charge can be taken.
    RAZORPAY_WEBHOOK_SECRET is reported separately because checkout works
    without it -- only the server-to-server backup path needs it."""
    missing = []
    for key in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"):
        value = os.getenv(key, "")
        if not value or value.startswith("your_"):
            missing.append(key)
    return missing


@router.get("/payment/config")
@router.get("/api/payment/config")
def payment_config():
    """Lets the checkout UI show a precise 'payment not configured' state
    (naming the missing variables) instead of opening a checkout that can
    never complete. Reports names only -- never values, and only the
    public key id, never the secret."""
    missing = _missing_payment_keys()
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if missing:
        logger.error("Payment is not configured. Missing: %s", ", ".join(missing))
    return {
        "configured": not missing,
        "missing": missing,
        "webhook_configured": bool(webhook_secret and not webhook_secret.startswith("your_")),
        "key_id": os.getenv("RAZORPAY_KEY_ID") if not missing else None,
    }


@router.post("/payment/create-order")
@router.post("/api/payment/create-order")
def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return PaymentService.create_order(db, current_user, req.plan_id, req.currency)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PaymentNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PaymentProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/payment/verify")
@router.post("/api/payment/verify")
def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = PaymentService.verify_payment(
        db=db,
        user=current_user,
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Payment verification failed"))
    return result


@router.post("/payment/webhook")
@router.post("/api/payment/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Server-to-server events from Razorpay.

    payment.captured is the backup for the client-side /payment/verify call:
    Razorpay calls this directly if the user closes the browser (or their
    network drops) right after paying but before the client handler runs.
    refund.processed ends the access a refunded payment bought.
    Configure this URL + RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard,
    subscribed to both events.

    Every call with a valid signature is appended to payment_events first
    (duplicates included) and committed before anything is processed. A call
    with a bad signature is rejected and not stored."""
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    body = await request.body()

    if not webhook_secret or webhook_secret.startswith("your_"):
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured.")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    signature = request.headers.get("X-Razorpay-Signature", "")
    expected_sig = hmac.new(webhook_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, signature):
        logger.warning("Razorpay webhook rejected: bad signature")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Webhook body is not valid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook body must be a JSON object")

    event = str(payload.get("event") or "unknown")
    payment = PaymentService.record_webhook_event(
        db, event, payload, request.headers.get("X-Razorpay-Event-Id"),
    )

    entities = payload.get("payload") or {}

    if event == "refund.processed":
        refund = (entities.get("refund") or {}).get("entity") or {}
        payment_id = refund.get("payment_id")
        if not payment_id:
            return {"status": "ignored", "reason": "missing payment_id"}
        result = PaymentService.apply_refund(db, payment_id, refund.get("amount"), raw=payload)
        return {"status": "processed" if result.get("success") else "rejected", "result": result}

    if event != "payment.captured":
        return {"status": "ignored", "event": event}

    payment_entity = (entities.get("payment") or {}).get("entity") or {}
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")
    if not order_id or not payment_id:
        return {"status": "ignored", "reason": "missing order_id/payment_id"}

    # The order must be one we created; the user comes from our own record,
    # and the user id Razorpay echoes back in the order notes has to agree.
    if payment is None or payment.user_id is None:
        return {"status": "rejected", "result": {"success": False, "message": "Unknown order."}}
    noted_user = (payment_entity.get("notes") or {}).get("user_id")
    if noted_user is not None and str(noted_user) != str(payment.user_id):
        logger.error("Webhook for order %s names user %s but the order belongs to %s", order_id, noted_user, payment.user_id)
        return {"status": "rejected", "result": {"success": False, "message": "Order does not belong to the named user."}}

    user = db.query(User).filter_by(id=payment.user_id).first()
    if not user:
        return {"status": "ignored", "reason": "user not found"}

    result = PaymentService.apply_webhook_payment(
        db, user, order_id, payment_id,
        paid_amount=payment_entity.get("amount"),
        paid_currency=payment_entity.get("currency"),
        raw=payload,
    )
    return {"status": "processed" if result.get("success") else "rejected", "result": result}


@router.get("/payment/status")
@router.get("/api/payment/status")
def payment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter_by(
        user_id=current_user.id,
        status="active",
    ).order_by(Subscription.created_at.desc()).first()

    tier = user_tier(current_user)
    return {
        "user_id": current_user.id,
        "tier": tier,
        "is_premium": tier != "free",
        "subscription": sub.to_dict() if sub else None,
    }
