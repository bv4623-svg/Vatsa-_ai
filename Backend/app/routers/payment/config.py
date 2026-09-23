import os

from app.services.payment_service import PaymentService
from app.routers.payment.router import router, logger


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
