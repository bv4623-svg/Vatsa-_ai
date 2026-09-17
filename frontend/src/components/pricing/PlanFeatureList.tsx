"use client";

import { Check, X } from "lucide-react";
import type { Plan } from "@/data/plans";

/** Included and not-included rows for one plan. Both lists are derived in
 * data/plans.ts from the same feature matrix the comparison table uses. */
export function PlanFeatureList({ plan }: { plan: Plan }) {
  return (
    <ul className="mb-6 flex-1 space-y-2.5">
      {plan.features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
          <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
        </li>
      ))}
      {plan.notIncluded.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <span className="text-sm text-gray-400 line-through dark:text-gray-500">
            {feature}
            <span className="sr-only"> (not included)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
