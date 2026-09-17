/**
 * Single source of truth for every plan, price and feature claim.
 *
 * The pricing page, the in-app upgrade modal, the upgrade banner and the
 * sidebar card all read from here. Nothing in the UI may hardcode a price,
 * a plan name or a feature row -- that is what let /pricing advertise
 * "$24/month" while the upgrade modal advertised "₹499/mo" for the same
 * plan.
 */

export type PlanId = "free" | "pro" | "business" | "ultra";
export type Currency = "USD" | "INR";
export type BillingPeriod = "monthly" | "annual";

export const GST_PCT = 18;
export const ANNUAL_DISCOUNT_PCT = 20;
export const DEFAULT_CURRENCY: Currency = "USD";

export interface FeatureRow {
  label: string;
  values: Record<PlanId, string | boolean>;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly list price, before GST. */
  priceUSD: number;
  priceINR: number;
  gstPct: number;
  annualDiscountPct: number;
  description: string;
  popular: boolean;
  cta: string;
  /** Derived from FEATURE_MATRIX -- see buildFeatureLists(). */
  features: string[];
  notIncluded: string[];
  note: string | null;
}

export interface FaqEntry {
  question: string;
  answer: string;
}
