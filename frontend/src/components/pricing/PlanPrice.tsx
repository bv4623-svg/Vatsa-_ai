"use client";

import { formatPrice, type Plan } from "@/data/plans";

/** Price for one plan: USD is primary, INR always shown alongside. Both
 * figures come from src/config/pricing.ts via data/plans.ts, so this card
 * and the upgrade modal cannot disagree. */
export function PlanPrice({ plan }: { plan: Plan }) {
  if (plan.priceUSD === 0) {
    return (
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">Free</span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{formatPrice(plan.priceUSD, "USD")}</span>
        <span className="text-gray-500 dark:text-gray-400">/ month</span>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        or {formatPrice(plan.priceINR, "INR")} / month
      </p>
    </>
  );
}
