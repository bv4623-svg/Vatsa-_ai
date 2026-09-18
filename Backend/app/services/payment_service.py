import os
import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config.pricing import PRICES_USD, PRICES_INR, ACCESS_DAYS
from app.models.user import User
from app.models.subscription import Subscription
from app.services.token_service import TokenService

logger = logging.getLogger("PaymentService")

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"

_PLAN_META = {
    "pro":      {"label": "Pro",      "tokens": 500000,  "tier": "pro"},
    "business": {"label": "Business", "tokens": 2000000, "tier": "business"},
}


class PaymentNotConfigured(Exception):
    """RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing on this server."""


class PaymentProviderError(Exception):
    """Razorpay rejected or could not be reached for an order request."""


def _smallest_unit(amount: float) -> int:
    """Major currency units -> paise/cents, the unit Razorpay charges in."""
    return int(round(amount * 100))


def _build_catalog() -> Dict[str, Dict[str, Any]]:
    catalog: Dict[str, Dict[str, Any]] = {}
    for plan_id, meta in _PLAN_META.items():
        for currency, prices in (("USD", PRICES_USD), ("INR", PRICES_INR)):
            catalog[f"{plan_id}:{currency}"] = {
                "id": plan_id,
                "name": f"{meta['label']} ({ACCESS_DAYS} days)",
                "amount_paise": _smallest_unit(prices[plan_id]),
                "currency": currency,
                "tokens": meta["tokens"],
                "tier": meta["tier"],
                "duration_days": ACCESS_DAYS,
            }
    return catalog


# Exactly four entries: {pro, business} x {USD, INR}. There is no other
# thing a customer can be charged for, and no fallback entry to land on.
PLANS: Dict[str, Dict[str, Any]] = _build_catalog()


def resolve_plan(plan_id: str, currency: str = "USD") -> Optional[Dict[str, Any]]:
    cur = "INR" if str(currency).upper() == "INR" else "USD"
    return PLANS.get(f"{plan_id}:{cur}")


def _razorpay_credentials() -> tuple[str, str]:
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret or key_id.startswith("your_") or key_secret.startswith("your_"):
        raise PaymentNotConfigured("Payments are not configured on this server.")
    return key_id, key_secret


def _create_razorpay_order(key_id: str, key_secret: str, amount: int, currency: str, receipt: str, notes: Dict[str, str]) -> str:
    try:
        res = httpx.post(
            RAZORPAY_ORDERS_URL,
            auth=(key_id, key_secret),
            json={"amount": amount, "currency": currency, "receipt": receipt, "notes": notes},
            timeout=10,
        )
        res.raise_for_status()
        return res.json()["id"]
    except Exception as e:
        logger.error("Razorpay order creation failed: %s", e)
        raise PaymentProviderError("The payment provider could not create the order. Try again shortly.") from e


class PaymentService:
    @staticmethod
    def get_plans() -> Dict[str, Dict[str, Any]]:
        return PLANS

    @staticmethod
    def create_order(db: Session, user: User, plan_id: str, currency: str = "USD") -> Dict[str, Any]:
        plan = resolve_plan(plan_id, currency)
        if not plan:
            # Fails loudly instead of guessing a different plan's price.
            raise ValueError(f"Unknown plan: {plan_id!r} ({currency})")

        key_id, key_secret = _razorpay_credentials()
        amount_paise = plan["amount_paise"]
        stamp = int(datetime.utcnow().timestamp())

        order_id = _create_razorpay_order(
            key_id, key_secret, amount_paise, plan["currency"],
            receipt=f"rcpt_{user.id}_{stamp}",
            notes={"user_id": str(user.id), "plan_id": plan["id"]},
        )

        db.add(Subscription(
            user_id=user.id,
            plan=plan["id"],
            order_id=order_id,
            status="pending",
            verified=False,
            amount=f"{amount_paise / 100:.2f}",
            currency=plan["currency"],
        ))
        db.commit()

        return {
            "order_id": order_id,
            "amount": amount_paise,
            "currency": plan["currency"],
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "key_id": key_id,
        }

    @staticmethod
    def verify_payment(db: Session, user: User, order_id: str, payment_id: str, signature: str) -> Dict[str, Any]:
        """Client-side handler result: Razorpay signs "order_id|payment_id"
        with the key secret. Only the order this user created is accepted --
        no fallback to "their most recent pending order"."""
        sub = db.query(Subscription).filter_by(order_id=order_id, user_id=user.id).first()
        if not sub:
            return {"success": False, "message": "Order not found for this account."}

        if sub.verified:
            return {"success": True, "message": "Payment already verified", "tier": user.tier, "plan": sub.plan}

        try:
            _, key_secret = _razorpay_credentials()
        except PaymentNotConfigured:
            logger.error("Payment verification attempted but Razorpay is not configured.")
            return {"success": False, "message": "Payment verification is not configured on this server."}

        message = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(key_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, signature or ""):
            return {"success": False, "message": "Invalid payment signature"}

        return PaymentService._apply_verified_payment(db, user, sub, payment_id)

    @staticmethod
    def _apply_verified_payment(db: Session, user: User, sub: Subscription, payment_id: str) -> Dict[str, Any]:
        """Grants the plan for a payment whose authenticity the caller has
        already established (client signature check or webhook signature
        check). Idempotent on Subscription.verified."""
        if sub.verified:
            return {"success": True, "message": "Payment already verified", "tier": user.tier, "plan": sub.plan}

        plan = resolve_plan(sub.plan, sub.currency or "USD")
        if not plan:
            logger.error("Verified payment %s references unknown plan %r", payment_id, sub.plan)
            return {"success": False, "message": "This payment does not match a plan we sell. Contact support with your payment id."}

        now = datetime.utcnow()
        # Renewing the same plan while it's still active extends it instead
        # of overlapping the paid days.
        current = (
            db.query(Subscription)
            .filter(Subscription.user_id == user.id, Subscription.verified.is_(True),
                    Subscription.plan == sub.plan, Subscription.expires_at > now)
            .order_by(Subscription.expires_at.desc())
            .first()
        )
        start = current.expires_at if current else now

        sub.payment_id = payment_id
        sub.verified = True
        sub.status = "active"
        sub.expires_at = start + timedelta(days=plan["duration_days"])
        sub.updated_at = now
        user.tier = plan["tier"]

        TokenService.credit_tokens(
            db=db,
            user_id=user.id,
            tokens=plan["tokens"],
            reason=f"Payment verified for {plan['name']}",
            reference_id=payment_id,
            tx_type="purchase",
        )

        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": f"Payment verified successfully! Credited {plan['tokens']:,} tokens.",
            "tier": user.tier,
            "plan": plan["name"],
            "tokens_added": plan["tokens"],
        }

    @staticmethod
    def apply_webhook_payment(
        db: Session,
        user: User,
        order_id: str,
        payment_id: str,
        paid_amount: Optional[int] = None,
        paid_currency: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Server-to-server backup for payment.captured. The caller has
        already verified the webhook signature; this additionally requires
        the order to be ours, this user's, and paid in full."""
        sub = db.query(Subscription).filter_by(order_id=order_id, user_id=user.id).first()
        if not sub:
            return {"success": False, "message": "Unknown order for this user."}

        expected = _smallest_unit(float(sub.amount or 0))
        if paid_amount is not None and paid_amount != expected:
            logger.error("Webhook amount mismatch for %s: paid %s, expected %s", order_id, paid_amount, expected)
            return {"success": False, "message": "Paid amount does not match the order."}
        if paid_currency is not None and paid_currency.upper() != (sub.currency or "").upper():
            logger.error("Webhook currency mismatch for %s: paid %s, expected %s", order_id, paid_currency, sub.currency)
            return {"success": False, "message": "Paid currency does not match the order."}

        return PaymentService._apply_verified_payment(db, user, sub, payment_id)

    @staticmethod
    def apply_refund(db: Session, payment_id: str, refunded_amount: Optional[int] = None) -> Dict[str, Any]:
        """A full refund ends the access that payment bought. The caller has
        already verified the webhook signature. Partial refunds are left
        alone: the refund policy only issues full refunds, so a partial one
        is a manual goodwill decision that should not silently cut access.
        Safe to call twice for the same refund."""
        sub = db.query(Subscription).filter_by(payment_id=payment_id).first()
        if not sub:
            return {"success": False, "message": "Unknown payment."}
        if sub.status == "refunded":
            return {"success": True, "already": True}

        paid = _smallest_unit(float(sub.amount or 0))
        if refunded_amount is not None and refunded_amount < paid:
            logger.info("Partial refund of %s on %s ignored; access unchanged", refunded_amount, payment_id)
            return {"success": True, "ignored": "partial refund"}

        now = datetime.utcnow()
        sub.status = "refunded"
        sub.expires_at = now

        still_covered = (
            db.query(Subscription.id)
            .filter(
                Subscription.user_id == sub.user_id,
                Subscription.id != sub.id,
                Subscription.verified.is_(True),
                Subscription.status != "refunded",
                Subscription.expires_at > now,
            )
            .first()
        )
        user = db.get(User, sub.user_id)
        downgraded = False
        if user and not still_covered and (user.tier or "free") != "free":
            user.tier = "free"
            downgraded = True
        db.commit()
        logger.info("Refund applied to %s (user %s, downgraded=%s)", payment_id, sub.user_id, downgraded)
        return {"success": True, "downgraded": downgraded}

