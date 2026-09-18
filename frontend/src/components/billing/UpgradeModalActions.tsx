"use client";

import { cn } from "@/lib/utils";
import { ACCESS_NOTE, formatBothPrices, getPlan, type PlanId } from "@/data/plans";

interface UpgradeModalActionsProps {
  onSelect: (planId: PlanId) => void;
  /** Plan the user is already on -- that button becomes "Current plan". */
  currentTier?: string;
}

/** The two upgrade buttons. Prices are read from data/plans.ts, the same
 * source the /pricing cards use, and always quote both currencies. */
export function UpgradeModalActions({ onSelect, currentTier }: UpgradeModalActionsProps) {
  const pro = getPlan("pro");
  const business = getPlan("business");

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
          {currentTier === "pro"
            ? "Current plan"
            : pro ? `Upgrade to ${pro.name} — ${formatBothPrices(pro)}/mo` : "Upgrade to Pro"}
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
          {currentTier === "business"
            ? "Current plan"
            : business ? `Go ${business.name} — ${formatBothPrices(business)}/mo` : "Go Business"}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">{ACCESS_NOTE}</p>
    </>
  );
}
