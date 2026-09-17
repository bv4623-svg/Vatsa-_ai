"use client";

import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import type { Currency } from "@/data/plans";

const OPTIONS: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD $" },
  { value: "INR", label: "INR ₹" },
];

/** India defaults to INR, everywhere else to USD; this lets a visitor
 * override that. The choice is shared with the in-app upgrade modal. */
export function CurrencySwitch() {
  const [currency, setCurrency] = useCurrency();

  return (
    <div
      role="group"
      aria-label="Display currency"
      className="inline-flex items-center rounded-full border border-gray-200 p-0.5 dark:border-gray-800"
    >
      {OPTIONS.map((option) => {
        const active = currency === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setCurrency(option.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
