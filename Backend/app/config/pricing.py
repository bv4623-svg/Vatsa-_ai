"""The ONLY place a plan price is written down on the backend.

Must match frontend/src/config/pricing.ts -- both sides hardcode the same
published numbers because a Python API and a TypeScript app share no
runtime. frontend/scripts/check-pricing-consistency.js parses both files
and fails the build if they ever disagree, or if a price literal shows up
anywhere else in either codebase.

Only two things can be bought: Pro and Business, each as one prepaid
30-day period. USD is the actual source of truth (PRICES_USD below).
INR is no longer this fixed rate times USD -- see app/services/
exchange_rate.py, which both the pricing page and the actual Razorpay
charge (payment_service.py) read from, using a live rate cached hourly.
USD_TO_INR below is kept only as the historical, disclosed reference rate
this feature replaced; nothing computes a live price from it anymore.
"""

PRICES_USD = {"pro": 24, "business": 99}

USD_TO_INR = 83

PRICES_INR = {plan: usd * USD_TO_INR for plan, usd in PRICES_USD.items()}

ACCESS_DAYS = 30
