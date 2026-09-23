"""Razorpay checkout, verification, status and webhook handling.

Split into router.py (shared APIRouter + logger), schemas.py, config.py
(plans/config endpoints), checkout.py (create-order/verify/status) and
webhook.py. `router` is re-exported here so `app.routers.payment.router`
(as used by app/main.py) keeps working unchanged.
"""
from app.routers.payment.router import router, logger
from app.routers.payment.schemas import CreateOrderRequest, VerifyPaymentRequest
from app.routers.payment import config, checkout, webhook  # noqa: F401
from app.routers.payment.config import get_plans, payment_config, _missing_payment_keys
from app.routers.payment.checkout import create_order, verify_payment, payment_status
from app.routers.payment.webhook import razorpay_webhook

__all__ = [
    "router", "logger", "CreateOrderRequest", "VerifyPaymentRequest",
    "get_plans", "payment_config", "_missing_payment_keys",
    "create_order", "verify_payment", "payment_status",
    "razorpay_webhook",
]
