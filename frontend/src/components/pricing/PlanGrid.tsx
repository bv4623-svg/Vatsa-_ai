"use client";

import { useRouter } from "next/navigation";
import { PricingPlanCard } from "./PricingPlanCard";
import { ACCESS_NOTE, PLANS, RATE_NOTE, type Plan } from "@/data/plans";

interface PlanGridProps {
  isAuthenticated: boolean;
  userTier: string;
}

/** Card order comes straight from PLANS: Free, Pro (popular), Business. */
export function PlanGrid({ isAuthenticated, userTier }: PlanGridProps) {
  const router = useRouter();

  const ctaLabel = (plan: Plan) => {
    if (plan.id === "free") return isAuthenticated ? "Go to workspace" : plan.cta;
    if (userTier === plan.id) return "Current plan";
    return plan.cta;
  };

  const handleSelect = (plan: Plan) => {
    if (plan.id === "free") {
      router.push(isAuthenticated ? "/chat" : "/signup?plan=free");
      return;
    }

    // Paid plans need an account before checkout can charge anything.
    const checkout = `/checkout?plan=${plan.id}`;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(checkout)}`);
      return;
    }
    router.push(checkout);
  };

  return (
    <section aria-label="Plans" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingPlanCard
            key={plan.id}
            plan={plan}
            ctaLabel={ctaLabel(plan)}
            isCurrent={isAuthenticated && userTier === plan.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
        {ACCESS_NOTE} {RATE_NOTE}
      </p>
    </section>
  );
}
