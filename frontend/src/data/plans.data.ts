import { ACCESS_DAYS, PRICES_INR, PRICES_USD } from "@/config/pricing";
import { FEATURE_MATRIX } from "./plans.matrix";
import type { Plan, PlanId } from "./plans.types";
import { DAILY_LIMITS, STORAGE_LIMIT_GB } from "./plans.limits";

function buildFeatureLists(id: PlanId): { features: string[]; notIncluded: string[] } {
  const features: string[] = [];
  const notIncluded: string[] = [];

  for (const row of FEATURE_MATRIX) {
    const value = row.values[id];
    if (value === false) notIncluded.push(row.label);
    else if (value === true) features.push(row.label);
    else features.push(`${row.label}: ${value}`);
  }

  return { features, notIncluded };
}

interface PlanSeed {
  id: PlanId;
  name: string;
  priceUSD: number;
  priceINR: number;
  description: string;
  popular: boolean;
  cta: string;
  note: string | null;
}

// Card order on /pricing: Free | Pro (Most Popular) | Business.
const PLAN_SEEDS: PlanSeed[] = [
  {
    id: "free",
    name: "Free",
    priceUSD: 0,
    priceINR: 0,
    description: "Basic access to get started",
    popular: false,
    cta: "Get Started Free",
    note: null,
  },
  {
    id: "pro",
    name: "Pro",
    priceUSD: PRICES_USD.pro,
    priceINR: PRICES_INR.pro,
    description: "Unleash the full power of AI",
    popular: true,
    cta: "Get Started",
    note: "Secure payment via Razorpay",
  },
  {
    id: "business",
    name: "Business",
    priceUSD: PRICES_USD.business,
    priceINR: PRICES_INR.business,
    description: "Enterprise-grade AI for teams",
    popular: false,
    cta: "Get Started",
    note: "Secure payment via Razorpay",
  },
];

export const PLANS: Plan[] = PLAN_SEEDS.map((seed) => ({
  ...seed,
  accessDays: ACCESS_DAYS,
  storageLimitGB: STORAGE_LIMIT_GB[seed.id],
  dailyLimits: DAILY_LIMITS[seed.id],
  ...buildFeatureLists(seed.id),
}));

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Paid plans only -- what checkout is allowed to charge for. */
export const PAID_PLAN_IDS: PlanId[] = PLANS.filter((p) => p.priceUSD > 0).map((p) => p.id);
