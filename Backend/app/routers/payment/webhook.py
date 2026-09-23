import os
import hmac
import hashlib
import json

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.payment_service import PaymentService
from app.routers.payment.router import router, logger


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
