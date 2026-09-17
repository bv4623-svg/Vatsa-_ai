"use client";

import { Info } from "lucide-react";
import {
  annualSavings,
  formatPrice,
  gstNote,
  periodLabel,
  periodPrice,
  type BillingPeriod,
  type Currency,
  type Plan,
} from "@/data/plans";

interface PlanPriceProps {
  plan: Plan;
  currency: Currency;
  period: BillingPeriod;
}

/** Price, annual saving and the GST line for one plan. All figures come
 * from data/plans.ts so the card and the upgrade modal cannot diverge. */
export function PlanPrice({ plan, currency, period }: PlanPriceProps) {
  const price = periodPrice(plan, currency, period);
  const note = gstNote(plan, currency, period);
  const savings = period === "annual" ? annualSavings(plan, currency) : 0;

  return (
    <>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{formatPrice(price, currency)}</span>
        <span className="text-gray-500 dark:text-gray-400">{periodLabel(period)}</span>
      </div>

      {savings > 0 && (
        <p className="mt-1 text-xs font-medium text-green-500">
          Save {formatPrice(savings, currency)} a year
        </p>
      )}

      {note && (
        <p className="mt-1 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}
    </>
  );
}
