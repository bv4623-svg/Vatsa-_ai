"use client";

import { cn } from "@/lib/utils";
import { ANNUAL_DISCOUNT_PCT, type BillingPeriod } from "@/data/plans";

interface BillingToggleProps {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}

/** Annual billing is live at {ANNUAL_DISCOUNT_PCT}% off, matching the
 * "Yearly (20% off)" offer the in-app upgrade modal advertises. */
export function BillingToggle({ period, onChange }: BillingToggleProps) {
  const annual = period === "annual";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3" role="group" aria-label="Billing period">
        <span
          className={cn(
            "text-sm font-medium",
            !annual ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"
          )}
        >
          Monthly
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Bill annually"
          onClick={() => onChange(annual ? "monthly" : "annual")}
          className={cn(
            "relative h-6 w-11 cursor-pointer rounded-full border border-transparent transition-colors",
            annual ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>

        <span
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            annual ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"
          )}
        >
          Annual
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-500">
            Save {ANNUAL_DISCOUNT_PCT}%
          </span>
        </span>
      </div>
    </div>
  );
}
