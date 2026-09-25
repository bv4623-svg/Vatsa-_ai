/**
 * The ONLY place a plan price is written down in the frontend.
 *
 * Everything that displays or charges a price (pricing page, upgrade modal,
 * banners, checkout, FAQs) reads from here, via src/data/plans.ts. Nothing
 * else may contain a price literal -- `npm run check:pricing` fails the
 * build if one appears, or if this file and Backend/app/config/pricing.py
 * ever disagree.
 *
 * Only two things can be bought: Pro and Business, each as one prepaid
 * 30-day period. USD is the actual source of truth (PRICES_USD below). INR
 * is no longer this fixed rate times USD -- the pricing page and checkout
 * both fetch GET /api/pricing/exchange-rate, which the backend computes
 * from a live rate cached hourly (Backend/app/services/exchange_rate.py)
 * and which Razorpay actually charges too, so what's shown is what's
 * charged. USD_TO_INR below is kept only as the historical, disclosed
 * reference rate this feature replaced -- PRICES_INR/formatBothPrices'
 * static INR figures are display fallbacks for before that fetch resolves,
 * not the live price.
 */

export const PRICES_USD = { pro: 24, business: 99 } as const;

/** Fixed, documented conversion: $1 = ₹83. Not a live exchange rate. */
export const USD_TO_INR = 83;

export const PRICES_INR = {
  pro: PRICES_USD.pro * USD_TO_INR,
  business: PRICES_USD.business * USD_TO_INR,
} as const;

/** Each payment buys this many days of access. Nothing renews automatically. */
export const ACCESS_DAYS = 30;

export type PaidPlanId = keyof typeof PRICES_USD;
