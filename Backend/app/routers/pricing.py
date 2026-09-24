import logging

from fastapi import APIRouter

from app.config.pricing import PRICES_USD
from app.services.exchange_rate import get_live_prices_inr

logger = logging.getLogger("PricingRouter")
router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.get("/exchange-rate")
def exchange_rate():
    """Current USD/INR rate (live, hourly-cached, or a last-resort fallback
    -- see app/services/exchange_rate.py) and the INR prices it produces
    for each plan. The pricing page and the actual Razorpay charge
    (payment_service.py) both read prices through this same function, so
    what a customer sees here is exactly what they're charged."""
    prices_inr, rate, source = get_live_prices_inr()
    return {
        "usd_to_inr": rate,
        "source": source,
        "prices_usd": PRICES_USD,
        "prices_inr": prices_inr,
    }
