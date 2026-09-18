"""The ONLY place a plan price is written down on the backend.

Must match frontend/src/config/pricing.ts -- both sides hardcode the same
published numbers because a Python API and a TypeScript app share no
runtime. frontend/scripts/check-pricing-consistency.js parses both files
and fails the build if they ever disagree, or if a price literal shows up
anywhere else in either codebase.

Only two things can be bought: Pro and Business, each as one prepaid
30-day period. Prices are tax-inclusive, so the amount charged is exactly
the amount shown. INR is always the USD price times the one fixed
USD_TO_INR rate below -- never an independently typed number.
"""

PRICES_USD = {"pro": 24, "business": 99}

USD_TO_INR = 83

PRICES_INR = {plan: usd * USD_TO_INR for plan, usd in PRICES_USD.items()}

ACCESS_DAYS = 30
