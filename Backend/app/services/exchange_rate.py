"""Live USD/INR exchange rate, used for BOTH what the pricing page displays
and what Razorpay actually charges for an INR order (payment_service.py) --
this codebase's pricing config (app/config/pricing.py) documents "the
amount charged is exactly the amount shown" as a hard invariant, so the
live rate is fetched and cached in exactly one place and both call sites
read the same cached value, rather than the display and the charge each
resolving their own rate independently and risking drift between them.

Two free, keyless providers, tried in order, then a last-resort constant
if both are unreachable -- logged as a warning, since that means every
`live` request in that window silently degraded to a fixed rate instead
of failing loudly. Cached in Redis (via app.utils.cache, already used
elsewhere in this codebase) for an hour so a burst of pricing-page loads
or checkout attempts costs one outbound HTTP call, not one per request.
"""
import logging
from typing import Optional, Tuple

import httpx

from app.config.pricing import PRICES_USD
from app.utils.cache import cache_get, cache_set

logger = logging.getLogger("ExchangeRate")

_CACHE_KEY = "fx:usd_inr_rate"
_CACHE_TTL_LIVE_SECONDS = 3600
# Shorter TTL for a fallback reading -- a transient provider outage should
# self-heal within minutes rather than pinning every price to the fallback
# for a full hour once one request happens to catch both providers down.
_CACHE_TTL_FALLBACK_SECONDS = 300

# frankfurter.app redirects (301) to frankfurter.dev as of 2026 -- pointing
# at the new host/path directly instead of relying on every request paying
# for a redirect round-trip (httpx does not follow redirects by default,
# so an unfollowed 301 here would fail closed to the second provider).
_FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=INR"
_OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD"

# Used only when neither live provider responds. Deliberately a plain
# float, not read from app.config.pricing.USD_TO_INR -- that constant is
# the historical, disclosed "fixed rate" this feature replaces for actual
# pricing, and frontend/scripts/check-pricing-consistency.js asserts it
# stays exactly as documented; this is an unrelated, independent number.
_FALLBACK_RATE = 88.0

_HTTP_TIMEOUT_SECONDS = 5.0


def _fetch_frankfurter() -> Optional[float]:
    try:
        resp = httpx.get(_FRANKFURTER_URL, timeout=_HTTP_TIMEOUT_SECONDS)
        resp.raise_for_status()
        rate = resp.json()["rates"]["INR"]
        return float(rate)
    except Exception as exc:
        logger.warning("exchange rate: frankfurter.app request failed (%s)", exc)
        return None


def _fetch_open_er_api() -> Optional[float]:
    try:
        resp = httpx.get(_OPEN_ER_API_URL, timeout=_HTTP_TIMEOUT_SECONDS)
        resp.raise_for_status()
        rate = resp.json()["rates"]["INR"]
        return float(rate)
    except Exception as exc:
        logger.warning("exchange rate: open.er-api.com request failed (%s)", exc)
        return None


def get_usd_to_inr_rate() -> Tuple[float, str]:
    """Returns (rate, source), where source is "live" or "fallback".
    Cache-first: a cache hit (either kind) is returned without any
    outbound request at all."""
    cached = cache_get(_CACHE_KEY)
    if cached is not None:
        return float(cached["rate"]), cached["source"]

    rate = _fetch_frankfurter()
    source = "live"
    if rate is None:
        rate = _fetch_open_er_api()
    if rate is None:
        logger.warning(
            "exchange rate: both live providers unreachable, using fallback rate"
        )
        rate = _FALLBACK_RATE
        source = "fallback"

    ttl = _CACHE_TTL_LIVE_SECONDS if source == "live" else _CACHE_TTL_FALLBACK_SECONDS
    cache_set(_CACHE_KEY, {"rate": rate, "source": source}, ttl)
    return rate, source


def round_to_nearest_10(amount: float) -> int:
    return int(round(amount / 10.0)) * 10


def get_live_prices_inr() -> Tuple[dict, float, str]:
    """Returns (prices_inr, rate, source) -- prices_inr has the same
    {"pro": ..., "business": ...} shape as app.config.pricing.PRICES_INR,
    computed from the current live (or fallback) rate and rounded to the
    nearest multiple of ten rupees."""
    rate, source = get_usd_to_inr_rate()
    prices_inr = {
        plan: round_to_nearest_10(usd * rate) for plan, usd in PRICES_USD.items()
    }
    return prices_inr, rate, source
