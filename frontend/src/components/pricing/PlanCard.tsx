"use client";
import React from "react";
import type { Plan, Tier } from "@/types/api/subscription";

type Props = {
  plan: Plan;
  tier: Tier;
  currentTier?: Tier;
  onSelect: (tier: Tier) => void;
};

export function PlanCard({ plan, tier, currentTier, onSelect }: Props) {
  const isCurrent = tier === currentTier;

  return (
    <div className="card rounded-2xl border p-6 shadow-sm">
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="my-2 text-2xl font-semibold">
        ₹{plan.price_inr}
        <span className="text-sm font-normal">/mo</span>
      </p>

      <ul className="my-4 space-y-1 text-sm">
        <li>✅ {plan.daily_tokens.toLocaleString()} tokens/day</li>
        <li>✅ {plan.max_tokens_per_request} max/request</li>
        <li>{plan.attachments ? "✅" : "❌"} Attachments</li>
        <li>{plan.tools ? "✅" : "❌"} Tools</li>
        <li>
          {plan.models.includes("*")
            ? "✅ All models"
            : `✅ ${plan.models.length} free models`}
        </li>
      </ul>

      <button
        disabled={isCurrent}
        onClick={() => onSelect(tier)}
        className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
      >
        {isCurrent ? "Current Plan" : "Upgrade"}
      </button>
    </div>
  );
}
