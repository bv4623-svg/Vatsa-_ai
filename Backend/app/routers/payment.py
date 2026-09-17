import os
import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.payment_service import PaymentService

logger = logging.getLogger("PaymentWebhook")

router = APIRouter(tags=["payment"])

class CreateOrderRequest(BaseModel):
    plan_id: str = "pro_monthly"
    billing_period: str = "monthly"
    currency: str = "USD"
    amount: Optional[int] = None  # ignored for security; server pricing is used

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
    never complete. Reports names only -- never values."""
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
    db: Session = Depends(get_db)
):
    try:
        order = PaymentService.create_order(
            db, current_user, req.plan_id, req.billing_period, req.currency
        )
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@router.post("/payment/verify")
@router.post("/api/payment/verify")
def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = PaymentService.verify_payment(
        db=db,
        user=current_user,
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Payment verification failed"))
    return result

@router.post("/payment/webhook")
@router.post("/api/payment/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Server-to-server backup for the client-side /payment/verify call --
    Razorpay calls this directly if the user closes the browser (or their
    network drops) right after paying but before the client handler runs.
    Configure this URL + RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard."""
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    body = await request.body()

    if not webhook_secret or webhook_secret.startswith("your_"):
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured.")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    signature = request.headers.get("X-Razorpay-Signature", "")
    expected_sig = hmac.new(webhook_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    if payload.get("event") != "payment.captured":
        return {"status": "ignored", "event": payload.get("event")}

    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")
    user_id = (payment_entity.get("notes") or {}).get("user_id")

    if not order_id or not payment_id or not user_id:
        return {"status": "ignored", "reason": "missing order_id/payment_id/user_id"}

    user = db.query(User).filter_by(id=int(user_id)).first()
    if not user:
        return {"status": "ignored", "reason": "user not found"}

    result = PaymentService.apply_webhook_payment(db, user, order_id, payment_id)
    return {"status": "processed", "result": result}


@router.get("/payment/status")
@router.get("/api/payment/status")
def payment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.subscription import Subscription
    sub = db.query(Subscription).filter_by(
        user_id=current_user.id,
        status="active"
    ).order_by(Subscription.created_at.desc()).first()

    return {
        "user_id": current_user.id,
        "tier": current_user.tier or "free",
        "is_premium": current_user.tier in ["pro", "paid", "premium"],
        "subscription": sub.to_dict() if sub else None
    }
