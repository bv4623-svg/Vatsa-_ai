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
ANNUAL_DISCOUNT = 0.20

# Mirrors frontend src/data/plans.ts. Both sides must agree or the price a
# user is shown is not the price they are charged, so the rounding here is
# deliberately the same two-step half-up the UI uses.
_LIST_PRICES = {
    #          USD    INR
    "pro":      (24.0,  499.0),
    "business": (99.0, 1999.0),
    "ultra":    (49.0, 1499.0),
}

_PLAN_META = {
    "pro":      {"label": "Pro",      "tokens": 500000,  "tier": "pro"},
    "business": {"label": "Business", "tokens": 2000000, "tier": "business"},
    "ultra":    {"label": "Ultra",    "tokens": 5000000, "tier": "ultra"},
}


def _round2(value: float) -> float:
    return round(value + 1e-9, 2)


def _smallest_unit_with_gst(base: float) -> int:
    """Base price -> amount in the currency's smallest unit, GST included."""
    gst = _round2(base * GST_RATE)
    total = _round2(base + gst)
    return int(round(total * 100))


def _build_catalog() -> Dict[str, Dict[str, Any]]:
    catalog: Dict[str, Dict[str, Any]] = {}
    for plan_id, (usd, inr) in _LIST_PRICES.items():
        meta = _PLAN_META[plan_id]
        for currency, monthly in (("USD", usd), ("INR", inr)):
            for period in ("monthly", "annual"):
                base = monthly if period == "monthly" else _round2(monthly * 12 * (1 - ANNUAL_DISCOUNT))
                catalog[f"{plan_id}:{period}:{currency}"] = {
                    "id": plan_id,
                    "name": f"{meta['label']} {period.capitalize()}",
                    "amount_paise": _smallest_unit_with_gst(base),
                    "currency": currency,
                    "tokens": meta["tokens"] if period == "monthly" else meta["tokens"] * 12,
                    "tier": meta["tier"],
                    "duration_days": 30 if period == "monthly" else 365,
                }
    return catalog


def resolve_plan(plan_id: str, billing_period: str = "monthly", currency: str = "USD") -> Optional[Dict[str, Any]]:
    """Look up a plan by the id the pricing page / upgrade modal sends."""
    period = "annual" if str(billing_period).lower() == "annual" else "monthly"
    cur = "INR" if str(currency).upper() == "INR" else "USD"
    return PLANS.get(f"{plan_id}:{period}:{cur}") or PLANS.get(plan_id)


PLANS: Dict[str, Dict[str, Any]] = _build_catalog()


class PaymentService:
    @staticmethod
    def get_plans() -> Dict[str, Dict[str, Any]]:
        return PLANS

    @staticmethod
    def create_order(
        db: Session,
        user: User,
        plan_id: str,
        billing_period: str = "monthly",
        currency: str = "USD",
    ) -> Dict[str, Any]:
        plan = resolve_plan(plan_id, billing_period, currency)
        if not plan:
            # No silent fallback to a different plan's price: an unrecognized
            # plan_id/period/currency combination must fail loudly rather
            # than risk charging the wrong amount for whatever the caller
            # actually asked to buy.
            raise ValueError(f"Unknown plan: {plan_id!r} ({billing_period}, {currency})")

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
        if plan["tier"] in ["pro", "paid", "premium", "ultra"]:
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
