import os
import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config.pricing import PRICES_USD, ACCESS_DAYS
from app.models.user import User
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.services import payment_ledger as ledger
from app.services.exchange_rate import get_live_prices_inr
from app.services.token_service import TokenService
from app.utils.cache import cache_get, cache_set

logger = logging.getLogger("PaymentService")

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"

_PLANS_CACHE_KEY = "payment:plans"
_PLANS_CACHE_TTL_SECONDS = 300  # USD half never changes; INR half tracks the live rate

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


def _catalog_entry(plan_id: str, meta: Dict[str, Any], currency: str, price_major_units: float) -> Dict[str, Any]:
    return {
        "id": plan_id,
        "name": f"{meta['label']} ({ACCESS_DAYS} days)",
        "amount_paise": _smallest_unit(price_major_units),
        "currency": currency,
        "tokens": meta["tokens"],
        "tier": meta["tier"],
        "duration_days": ACCESS_DAYS,
    }


def _build_usd_catalog() -> Dict[str, Dict[str, Any]]:
    return {
        f"{plan_id}:USD": _catalog_entry(plan_id, meta, "USD", PRICES_USD[plan_id])
        for plan_id, meta in _PLAN_META.items()
    }


# USD entries only -- fixed, built once at import time. INR entries are
# resolved fresh on every call (see resolve_plan/get_plans below) from the
# same live, hourly-cached exchange rate the pricing page displays
# (app/services/exchange_rate.py), so what a customer sees is always
# exactly what they're charged. The historical fixed-rate PRICES_INR is no
# longer used for the actual charge.
PLANS: Dict[str, Dict[str, Any]] = _build_usd_catalog()


def _build_inr_catalog() -> Dict[str, Dict[str, Any]]:
    prices_inr, _rate, _source = get_live_prices_inr()
    return {
        f"{plan_id}:INR": _catalog_entry(plan_id, meta, "INR", prices_inr[plan_id])
        for plan_id, meta in _PLAN_META.items()
    }


def resolve_plan(plan_id: str, currency: str = "USD") -> Optional[Dict[str, Any]]:
    if str(currency).upper() != "INR":
        return PLANS.get(f"{plan_id}:USD")
    return _build_inr_catalog().get(f"{plan_id}:INR")


def _razorpay_credentials() -> tuple[str, str]:
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret or key_id.startswith("your_") or key_secret.startswith("your_"):
        raise PaymentNotConfigured("Payments are not configured on this server.")
    return key_id, key_secret


def _create_razorpay_order(key_id: str, key_secret: str, amount: int, currency: str, receipt: str, notes: Dict[str, str]) -> Dict[str, Any]:
    """Creates the order and returns Razorpay's full response (its `id` is
    the order id); the whole response is kept in the ledger for audit."""
    try:
        res = httpx.post(
            RAZORPAY_ORDERS_URL,
            auth=(key_id, key_secret),
            json={"amount": amount, "currency": currency, "receipt": receipt, "notes": notes},
            timeout=10,
        )
        res.raise_for_status()
        order = res.json()
        if not order.get("id"):
            raise ValueError("Razorpay response had no order id")
        return order
    except Exception as e:
        logger.error("Razorpay order creation failed: %s", e)
        raise PaymentProviderError("The payment provider could not create the order. Try again shortly.") from e


class PaymentService:
    @staticmethod
    def get_plans() -> Dict[str, Dict[str, Any]]:
        # PLANS (USD) is a fixed in-memory dict built once at import time;
        # the INR half is resolved fresh from the live/cached exchange rate
        # (app/services/exchange_rate.py) so a customer sees the same INR
        # price here as they'll actually be charged in create_order() below.
        # This cache layer just avoids rebuilding the combined dict (and
        # exercises the hit/miss counters, like the other read paths) on
        # every single request -- its short TTL sits well inside the
        # exchange rate's own 1-hour cache window, so it never disagrees
        # with what create_order() charges in that window.
        cached = cache_get(_PLANS_CACHE_KEY)
        if cached is not None:
            return cached
        combined = {**PLANS, **_build_inr_catalog()}
        cache_set(_PLANS_CACHE_KEY, combined, _PLANS_CACHE_TTL_SECONDS)
        return combined

    @staticmethod
    def create_order(db: Session, user: User, plan_id: str, currency: str = "USD") -> Dict[str, Any]:
        plan = resolve_plan(plan_id, currency)
        if not plan:
            # Fails loudly instead of guessing a different plan's price.
            raise ValueError(f"Unknown plan: {plan_id!r} ({currency})")

        key_id, key_secret = _razorpay_credentials()
        amount_paise = plan["amount_paise"]
        stamp = int(datetime.utcnow().timestamp())

        # The ledger row is committed BEFORE Razorpay is called, so an order
        # that dies mid-request still leaves a trace. The email is a snapshot.
        payment = Payment(
            user_id=user.id,
            email=user.email,
            razorpay_order_id=None,
            amount=amount_paise,
            currency=plan["currency"],
            plan=plan["id"],
            status=ledger.CREATED,
            raw_payload={},
        )
        db.add(payment)
        db.commit()

        try:
            order = _create_razorpay_order(
                key_id, key_secret, amount_paise, plan["currency"],
                receipt=f"rcpt_{user.id}_{stamp}",
                notes={"user_id": str(user.id), "email": user.email, "plan": plan["id"]},
            )
        except PaymentProviderError:
            ledger.advance_status(payment, ledger.FAILED)
            ledger.add_event(db, payment, "order.failed", {"reason": "provider_error"})
            db.commit()
            raise

        order_id = order["id"]
        payment.razorpay_order_id = order_id
        ledger.merge_raw(payment, "order", order)
        ledger.add_event(db, payment, "order.created", {
            "order_id": order_id, "amount": amount_paise, "currency": plan["currency"], "plan": plan["id"],
        })
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
            # Recorded, never applied. The unverified payment id and the
            # signature stay out of the row: only a valid check may write them.
            payment = ledger.ledger_for_subscription(db, user, sub)
            ledger.advance_status(payment, ledger.FAILED)
            ledger.add_event(db, payment, "verify.failed", {
                "razorpay_order_id": order_id, "razorpay_payment_id": payment_id,
            })
            db.commit()
            return {"success": False, "message": "Invalid payment signature"}

        return PaymentService._apply_verified_payment(
            db, user, sub, payment_id,
            signature=signature,
            raw_key="verify",
            raw={"razorpay_order_id": order_id, "razorpay_payment_id": payment_id},
            event_type="verify.succeeded",
        )

    @staticmethod
    def _apply_verified_payment(
        db: Session,
        user: User,
        sub: Subscription,
        payment_id: str,
        signature: Optional[str] = None,
        raw_key: str = "verify",
        raw: Optional[Dict[str, Any]] = None,
        event_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Grants the plan for a payment whose authenticity the caller has
        already established (client signature check or webhook signature
        check) and marks the ledger row captured in the same commit.
        Idempotent on Subscription.verified. `event_type` is only set by
        callers that do not already log their own event (the webhook does)."""
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

        payment = ledger.ledger_for_subscription(db, user, sub)
        payment.razorpay_payment_id = payment_id
        if signature:
            payment.razorpay_signature = signature
        ledger.advance_status(payment, ledger.CAPTURED)
        if raw is not None:
            ledger.merge_raw(payment, raw_key, raw)
        if event_type:
            ledger.add_event(db, payment, event_type, {
                "razorpay_order_id": sub.order_id, "razorpay_payment_id": payment_id,
            })

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
    def record_webhook_event(
        db: Session,
        event_type: str,
        body: Dict[str, Any],
        razorpay_event_id: Optional[str] = None,
    ) -> Optional[Payment]:
        """Appends a payment_events row for a webhook whose signature the
        caller has already verified, and commits it before any processing so
        history survives a failure in that processing. Duplicate deliveries
        each get their own row. Returns the ledger row the event belongs to,
        or None when it is about an order we have no record of."""
        entities = body.get("payload") or {}
        payment_entity = (entities.get("payment") or {}).get("entity") or {}
        refund_entity = (entities.get("refund") or {}).get("entity") or {}

        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id") or refund_entity.get("payment_id")

        payment: Optional[Payment] = None
        if order_id:
            payment = ledger.ledger_for_order(db, order_id)
            if payment is None:
                # An order made before the ledger existed: build its row from
                # our own Subscription record, never from webhook data.
                sub = db.query(Subscription).filter_by(order_id=order_id).first()
                user = db.get(User, sub.user_id) if sub else None
                if sub and user:
                    payment = ledger.ledger_for_subscription(db, user, sub)
        if payment is None and payment_id:
            payment = db.query(Payment).filter(Payment.razorpay_payment_id == payment_id).first()

        ledger.add_event(db, payment, event_type, body, razorpay_event_id)
        db.commit()
        return payment

    @staticmethod
    def apply_webhook_payment(
        db: Session,
        user: User,
        order_id: str,
        payment_id: str,
        paid_amount: Optional[int] = None,
        paid_currency: Optional[str] = None,
        raw: Optional[Dict[str, Any]] = None,
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

        if sub.verified:
            # The browser got there first. Still keep Razorpay's own record.
            if raw is not None:
                payment = ledger.ledger_for_subscription(db, user, sub)
                ledger.merge_raw(payment, "webhook_payment_captured", raw)
                db.commit()
            return {"success": True, "message": "Payment already verified", "tier": user.tier, "plan": sub.plan}

        return PaymentService._apply_verified_payment(
            db, user, sub, payment_id, raw_key="webhook_payment_captured", raw=raw,
        )

    @staticmethod
    def apply_refund(
        db: Session,
        payment_id: str,
        refunded_amount: Optional[int] = None,
        raw: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """A full refund ends the access that payment bought and marks the
        ledger row refunded. The caller has already verified the webhook
        signature. Partial refunds are left alone: the refund policy only
        issues full refunds, so a partial one is a manual goodwill decision
        that should not silently cut access. Safe to call twice."""
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

        user = db.get(User, sub.user_id)
        if user:
            payment = ledger.ledger_for_subscription(db, user, sub)
            ledger.advance_status(payment, ledger.REFUNDED)
            if raw is not None:
                ledger.merge_raw(payment, "webhook_refund_processed", raw)

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
        downgraded = False
        if user and not still_covered and (user.tier or "free") != "free":
            user.tier = "free"
            downgraded = True
        db.commit()
        logger.info("Refund applied to %s (user %s, downgraded=%s)", payment_id, sub.user_id, downgraded)
        return {"success": True, "downgraded": downgraded}
