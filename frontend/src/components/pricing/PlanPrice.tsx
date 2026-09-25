"use client";

import { formatPrice, type Plan } from "@/data/plans";

interface PlanPriceProps {
  plan: Plan;
  /** Live-rate INR price (GET /api/pricing/exchange-rate) -- the same
   * figure Razorpay actually charges. Falls back to plan.priceINR (the
   * static, fixed-rate figure) when omitted or while still loading. */
  liveInr?: number;
  isLoadingLiveInr?: boolean;
}

/** Price for one plan: USD is primary, INR always shown alongside. USD and
 * the static INR fallback come from src/config/pricing.ts via
 * data/plans.ts; the live INR figure (once fetched) is what checkout will
 * actually charge, so this card never advertises a different number. */
export function PlanPrice({ plan, liveInr, isLoadingLiveInr = false }: PlanPriceProps) {
  if (plan.priceUSD === 0) {
    return (
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">Free</span>
      </div>
    );
  }

  const inrAmount = liveInr ?? plan.priceINR;

  return (
    <>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{formatPrice(plan.priceUSD, "USD")}</span>
        <span className="text-gray-500 dark:text-gray-400">/ month</span>
      </div>
      {isLoadingLiveInr ? (
        <div className="mt-1.5 h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
      ) : (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          or {formatPrice(inrAmount, "INR")} / month
        </p>
      )}
    </>
  );
}
