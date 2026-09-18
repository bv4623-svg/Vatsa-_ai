"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Magnetic } from "./Magnetic";
import { PlanPrice } from "./PlanPrice";
import { PlanFeatureList } from "./PlanFeatureList";
import type { Plan } from "@/data/plans";

interface PricingPlanCardProps {
  plan: Plan;
  ctaLabel: string;
  isCurrent: boolean;
  onSelect: (plan: Plan) => void;
}

export function PricingPlanCard({ plan, ctaLabel, isCurrent, onSelect }: PricingPlanCardProps) {
  return (
    <div
      className={cn(
        "pricing-card relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-gray-950",
        plan.popular ? "pricing-card-popular border-blue-600" : "border-gray-200 dark:border-gray-800"
      )}
    >
      {plan.popular && (
        <span className="badge-popular absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold">
          Most Popular
        </span>
      )}

      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{plan.name}</h2>
          {plan.popular && <Star className="h-4 w-4 fill-blue-500 text-blue-500" aria-hidden="true" />}
        </div>

        <PlanPrice plan={plan} />

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>
      </div>

      <PlanFeatureList plan={plan} />

      <div className="mt-auto">
        <Magnetic strength={0.2}>
          <button
            type="button"
            onClick={() => onSelect(plan)}
            disabled={isCurrent}
            aria-label={`${ctaLabel} — ${plan.name} plan`}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-all",
              plan.popular ? "btn-primary" : "btn-outline",
              isCurrent && "cursor-not-allowed opacity-60"
            )}
          >
            {ctaLabel}
          </button>
        </Magnetic>
        {plan.note && (
          <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">{plan.note}</p>
        )}
      </div>
    </div>
  );
}
