import {
  DEFAULT_CURRENCY,
  GST_PCT,
  type BillingPeriod,
  type Currency,
  type Plan,
} from "./plans.types";

export function listPrice(plan: Plan, currency: Currency): number {
  return currency === "INR" ? plan.priceINR : plan.priceUSD;
}

/** Annual is billed once a year at 12 months less the annual discount. */
export function annualPrice(plan: Plan, currency: Currency): number {
  const monthly = listPrice(plan, currency);
  return round2(monthly * 12 * (1 - plan.annualDiscountPct / 100));
}

export function annualSavings(plan: Plan, currency: Currency): number {
  const monthly = listPrice(plan, currency);
  return round2(monthly * 12 - annualPrice(plan, currency));
}

/** Price for the selected billing period, before GST. */
export function periodPrice(plan: Plan, currency: Currency, period: BillingPeriod): number {
  return period === "annual" ? annualPrice(plan, currency) : listPrice(plan, currency);
}

export function gstAmount(amount: number, gstPct: number = GST_PCT): number {
  return round2(amount * (gstPct / 100));
}

export function totalWithGst(amount: number, gstPct: number = GST_PCT): number {
  return round2(amount + gstAmount(amount, gstPct));
}

/** Half-up to 2dp so a displayed total always matches what is charged. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function periodLabel(period: BillingPeriod): string {
  return period === "annual" ? "/year" : "/month";
}

export function periodNoun(period: BillingPeriod): string {
  return period === "annual" ? "year" : "month";
}

/** "+ 18% GST. Total $28.32 per month including GST." */
export function gstNote(plan: Plan, currency: Currency, period: BillingPeriod): string | null {
  const base = periodPrice(plan, currency, period);
  if (base <= 0) return null;
  const total = formatPrice(totalWithGst(base, plan.gstPct), currency);
  return `+ ${plan.gstPct}% GST. Total ${total} per ${periodNoun(period)} including GST.`;
}

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
