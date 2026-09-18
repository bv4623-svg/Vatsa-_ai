/**
 * Single source of truth for every plan, price and feature claim.
 *
 * The pricing page, the in-app upgrade modal, the upgrade banner and the
 * sidebar card all read from here. Nothing in the UI may hardcode a price,
 * a plan name or a feature row. The prices themselves live one level down
 * in src/config/pricing.ts.
 */

import type { PaidPlanId } from "@/config/pricing";

export type PlanId = "free" | PaidPlanId;
export type Currency = "USD" | "INR";

export const DEFAULT_CURRENCY: Currency = "USD";

export interface FeatureRow {
  label: string;
  values: Record<PlanId, string | boolean>;
}

/** Daily caps enforced at the API layer (Backend app/services/feature_access.py).
 * Mirrored here so quota banners can show the real ceiling without a round trip. */
export interface DailyLimits {
  chat: number;
  code: number;
  image: number;
  search: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** What the plan costs for one access period, tax included. */
  priceUSD: number;
  priceINR: number;
  /** Days of access one payment buys. */
  accessDays: number;
  description: string;
  popular: boolean;
  cta: string;
  /** Derived from FEATURE_MATRIX -- see buildFeatureLists(). */
  features: string[];
  notIncluded: string[];
  note: string | null;
  /** Library storage ceiling. Usage is summed from real rows, never faked. */
  storageLimitGB: number;
  dailyLimits: DailyLimits;
}

export interface FaqEntry {
  question: string;
  answer: string;
}
