import os
import hmac
import hashlib
import json
import logging
import urllib.request
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.subscription import Subscription
from app.services.token_service import TokenService

logger = logging.getLogger("PaymentService")

GST_RATE = 0.18

# Plan ids used by the pricing page CTAs (/checkout?plan=pro|business).
# Amounts are the published USD list prices plus the 18% GST shown on the
# pricing page -- Razorpay charges in the smallest currency unit, so
# $24.00 + 18% GST = $28.32 = 2832 cents.
def _usd_with_gst(dollars: float) -> int:
    return int(round(dollars * (1 + GST_RATE) * 100))


PLANS: Dict[str, Dict[str, Any]] = {
    "pro": {
        "id": "pro",
        "name": "Pro Monthly",
        "amount_paise": _usd_with_gst(24.00),
        "currency": "USD",
        "tokens": 500000,
        "tier": "pro",
        "duration_days": 30,
    },
    "business": {
        "id": "business",
        "name": "Business Monthly",
        "amount_paise": _usd_with_gst(99.00),
        "currency": "USD",
        "tokens": 2000000,
        "tier": "pro",
        "duration_days": 30,
    },
    "pro_monthly": {
        "id": "pro_monthly",
        "name": "Pro Monthly",
        "amount_paise": 79900,  # ₹799 in paise
        "currency": "INR",
        "tokens": 500000,
        "tier": "pro",
        "duration_days": 30
    },
    "pro_annual": {
        "id": "pro_annual",
        "name": "Pro Annual",
        "amount_paise": 799900,  # ₹7,999 in paise
        "currency": "INR",
        "tokens": 6000000,
        "tier": "pro",
        "duration_days": 365
    },
    "tokens_150k": {
        "id": "tokens_150k",
        "name": "150,000 Tokens",
        "amount_paise": 19900,  # ₹199 in paise
        "currency": "INR",
        "tokens": 150000,
        "tier": "free",
        "duration_days": None
    },
    "tokens_1m": {
        "id": "tokens_1m",
        "name": "1,000,000 Tokens",
        "amount_paise": 99900,  # ₹999 in paise
        "currency": "INR",
        "tokens": 1000000,
        "tier": "pro",
        "duration_days": None
    }
}

class PaymentService:
    @staticmethod
    def get_plans() -> Dict[str, Dict[str, Any]]:
        return PLANS

    @staticmethod
    def create_order(db: Session, user: User, plan_id: str) -> Dict[str, Any]:
        plan = PLANS.get(plan_id)
        if not plan:
            # Fallback for generic 'monthly' or 'annual' IDs
            if "annual" in plan_id.lower() or "year" in plan_id.lower():
                plan = PLANS["pro_annual"]
            else:
                plan = PLANS["pro_monthly"]

        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")

        amount_paise = plan["amount_paise"]
        currency = plan["currency"]

        # Call Razorpay API if credentials exist
        order_id = f"order_{int(datetime.utcnow().timestamp())}_{user.id}"
        if key_id and key_secret and not key_id.startswith("your_"):
            try:
                auth_str = f"{key_id}:{key_secret}"
                b64_auth = base64.b64encode(auth_str.encode()).decode()
                req_data = json.dumps({
                    "amount": amount_paise,
                    "currency": currency,
                    "receipt": f"rcpt_{user.id}_{int(datetime.utcnow().timestamp())}",
                    "notes": {"user_id": str(user.id), "plan_id": plan["id"]}
                }).encode("utf-8")

                req = urllib.request.Request(
                    "https://api.razorpay.com/v1/orders",
                    data=req_data,
                    headers={
                        "Authorization": f"Basic {b64_auth}",
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())
                    order_id = data.get("id", order_id)
            except Exception as e:
                logger.error(f"Razorpay order creation error: {e}")
                # Fallback to internal order ID for test environment

        # Save pending subscription/order in database
        sub = Subscription(
            user_id=user.id,
            plan=plan["id"],
            order_id=order_id,
            status="pending",
            verified=False,
            amount=str(amount_paise / 100),
            currency=currency
        )
        db.add(sub)
        db.commit()

        return {
            "order_id": order_id,
            "amount": amount_paise,
            "currency": currency,
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "key_id": key_id or "rzp_test_placeholder"
        }

    @staticmethod
    def verify_payment(
        db: Session,
        user: User,
        order_id: str,
        payment_id: str,
        signature: str
    ) -> Dict[str, Any]:
        key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

        # Look up the order in subscriptions
        sub = db.query(Subscription).filter_by(order_id=order_id, user_id=user.id).first()
        if not sub:
            # Fallback to most recent pending subscription
            sub = db.query(Subscription).filter_by(user_id=user.id, status="pending").order_by(Subscription.created_at.desc()).first()

        # Idempotency check: if already verified, return cached success
        if sub and sub.verified:
            return {
                "success": True,
                "message": "Payment already verified",
                "tier": user.tier,
                "plan": sub.plan
            }

        # Verify signature. If Razorpay isn't configured, refuse rather than
        # accept arbitrary caller-supplied ids as a "verified" payment --
        # tokens/tier upgrades must never be grantable without a real,
        # cryptographically verified payment.
        if not key_secret or key_secret.startswith("your_"):
            logger.error("Payment verification attempted but RAZORPAY_KEY_SECRET is not configured.")
            return {"success": False, "message": "Payment verification is not configured on this server."}

        message = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(key_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(expected_sig, signature)

        if not is_valid:
            return {"success": False, "message": "Invalid payment signature"}

        return PaymentService._apply_verified_payment(db, user, sub, order_id, payment_id)

    @staticmethod
    def _apply_verified_payment(
        db: Session,
        user: User,
        sub: Optional[Subscription],
        order_id: str,
        payment_id: str,
    ) -> Dict[str, Any]:
        """Credits tokens and upgrades the user's tier for a payment whose
        authenticity has already been established by the caller (either the
        client-side signature check in verify_payment, or the webhook's own
        signature check). Idempotent on Subscription.verified."""
        if sub and sub.verified:
            return {
                "success": True,
                "message": "Payment already verified",
                "tier": user.tier,
                "plan": sub.plan
            }

        plan_id = sub.plan if sub else "pro_monthly"
        plan = PLANS.get(plan_id, PLANS["pro_monthly"])

        if not sub:
            sub = Subscription(user_id=user.id, plan=plan_id, order_id=order_id)
            db.add(sub)

        sub.payment_id = payment_id
        sub.verified = True
        sub.status = "active"
        if plan["duration_days"]:
            sub.expires_at = datetime.utcnow() + timedelta(days=plan["duration_days"])
        sub.updated_at = datetime.utcnow()

        # Upgrade User tier if applicable
        if plan["tier"] in ["pro", "paid", "premium"]:
            user.tier = plan["tier"]

        # Credit Tokens idempotently
        TokenService.credit_tokens(
            db=db,
            user_id=user.id,
            tokens=plan["tokens"],
            reason=f"Payment verified for {plan['name']}",
            reference_id=payment_id,
            tx_type="purchase"
        )

        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": f"Payment verified successfully! Credited {plan['tokens']:,} tokens.",
            "tier": user.tier,
            "plan": plan["name"],
            "tokens_added": plan["tokens"]
        }

    @staticmethod
    def apply_webhook_payment(db: Session, user: User, order_id: str, payment_id: str) -> Dict[str, Any]:
        """Backup path for Razorpay's server-to-server webhook (payment.captured).
        Caller must have already verified the webhook signature."""
        sub = db.query(Subscription).filter_by(order_id=order_id, user_id=user.id).first()
        if not sub:
            sub = db.query(Subscription).filter_by(user_id=user.id, status="pending").order_by(Subscription.created_at.desc()).first()
        return PaymentService._apply_verified_payment(db, user, sub, order_id, payment_id)
