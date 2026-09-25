"use client";

import { cn } from "@/lib/utils";
import { ACCESS_NOTE, formatPrice, getPlan, type PlanId } from "@/data/plans";
import { useLiveInrPrices } from "@/hooks/useLiveInrPrices";

interface UpgradeModalActionsProps {
  onSelect: (planId: PlanId) => void;
  /** Plan the user is already on -- that button becomes "Current plan". */
  currentTier?: string;
}

/** The two upgrade buttons. USD is read from data/plans.ts; INR is the
 * live rate (GET /api/pricing/exchange-rate, same as the pricing page and
 * checkout) so this modal never quotes a different INR figure than what
 * checkout actually charges. */
export function UpgradeModalActions({ onSelect, currentTier }: UpgradeModalActionsProps) {
  const pro = getPlan("pro");
  const business = getPlan("business");
  const { prices: liveInr } = useLiveInrPrices();

  const label = (plan: ReturnType<typeof getPlan>, verb: string) =>
    plan ? `${verb} ${plan.name} — ${formatPrice(plan.priceUSD, "USD")} (${formatPrice(liveInr[plan.id as "pro" | "business"], "INR")})/mo` : `${verb}`;

  return (
    <>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onSelect("pro")}
          disabled={currentTier === "pro"}
          className={cn(
            "flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform",
            currentTier === "pro" ? "cursor-not-allowed opacity-60" : "hover:scale-[1.02]"
          )}
        >
          {currentTier === "pro" ? "Current plan" : label(pro, "Upgrade to")}
        </button>
        <button
          type="button"
          onClick={() => onSelect("business")}
          disabled={currentTier === "business"}
          className={cn(
            "flex-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-500 transition-colors",
            currentTier === "business" ? "cursor-not-allowed opacity-60" : "hover:bg-cyan-500/20"
          )}
        >
          {currentTier === "business" ? "Current plan" : label(business, "Go")}
        </button>
      </div>
      {currentTier !== "business" && (
        <p className="mt-2 text-center text-[11px] font-medium text-purple-500">⚡ Business is 5x more power than Pro</p>
      )}
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">{ACCESS_NOTE}</p>
    </>
  );
}
