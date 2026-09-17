"use client";

import { useRouter } from "next/navigation";
import { PricingPlanCard } from "./PricingPlanCard";
import { PLANS, type BillingPeriod, type Currency, type Plan } from "@/data/plans";

interface PlanGridProps {
  currency: Currency;
  period: BillingPeriod;
  isAuthenticated: boolean;
  userTier: string;
}

/** Card order comes straight from PLANS: Free, Pro (popular), Business, Ultra. */
export function PlanGrid({ currency, period, isAuthenticated, userTier }: PlanGridProps) {
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
    const checkout = `/checkout?plan=${plan.id}&billing=${period}&currency=${currency}`;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(checkout)}`);
      return;
    }
    router.push(checkout);
  };

  return (
    <section aria-label="Plans" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <PricingPlanCard
            key={plan.id}
            plan={plan}
            currency={currency}
            period={period}
            ctaLabel={ctaLabel(plan)}
            isCurrent={isAuthenticated && userTier === plan.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </section>
  );
}
