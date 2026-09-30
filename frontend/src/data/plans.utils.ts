import { ACCESS_DAYS } from "@/config/pricing";
import { DEFAULT_CURRENCY, type Currency, type Plan } from "./plans.types";

export function listPrice(plan: Plan, currency: Currency): number {
  return currency === "INR" ? plan.priceINR : plan.priceUSD;
}

/** Whole-unit amounts only: every price is a whole number, and the
 * charged amount is exactly the displayed one. */
export function formatPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Price with a per-month suffix; USD is always the primary currency. */
export function formatPlanPrice(plan: Plan, currency: Currency = DEFAULT_CURRENCY): string {
  return `${formatPrice(listPrice(plan, currency), currency)} / month`;
}

/** Both currencies together, USD first, INR in brackets. */
export function formatBothPrices(plan: Plan): string {
  return `${formatPrice(plan.priceUSD, "USD")} (${formatPrice(plan.priceINR, "INR")})`;
}

/** The one place the exchange rate is explained to customers. INR prices
 * are computed from a live rate refreshed hourly (see GET
 * /api/pricing/exchange-rate), and checkout charges that same figure. No
 * fixed rate is quoted: USD_TO_INR (83) is neither the live rate nor the
 * backend's fallback (exchange_rate.py uses 88 when both providers fail). */
export const RATE_NOTE = "INR prices are based on the live USD/INR rate (updated hourly) and rounded to the nearest multiple of ten -- the same amount checkout charges.";

/** What one payment buys -- there is no auto-renewal. */
export const ACCESS_NOTE = `Prices include all taxes. One payment gives ${ACCESS_DAYS} days of access; nothing renews automatically.`;

/* ─── Currency by region ──────────────────────────────────────────── */

/**
 * India gets INR, everyone else USD. Reads the browser locale and time
 * zone, so it must only run on the client -- calling it during SSR would
 * render one currency on the server and another after hydration.
 */
export function detectCurrency(): Currency {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/Calcutta|Kolkata/i.test(timeZone)) return "INR";
    const locales = [navigator.language, ...(navigator.languages || [])];
    if (locales.some((l) => /-IN$/i.test(l || ""))) return "INR";
  } catch {
    // Locale APIs unavailable -- fall through to the default.
  }
  return DEFAULT_CURRENCY;
}
