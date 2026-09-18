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
 * 30-day period. Prices are tax-inclusive, so the amount charged is exactly
 * the amount shown. INR is always the USD price times the single fixed
 * USD_TO_INR rate below -- never an independently typed number.
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
