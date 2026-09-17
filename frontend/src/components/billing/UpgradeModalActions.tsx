"use client";

import { cn } from "@/lib/utils";
import {
  ANNUAL_DISCOUNT_PCT,
  formatPrice,
  getPlan,
  listPrice,
  periodPrice,
  type BillingPeriod,
  type Currency,
  type PlanId,
} from "@/data/plans";

interface UpgradeModalActionsProps {
  currency: Currency;
  period: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
  onSelect: (planId: PlanId) => void;
  /** Plan the user is already on -- that button becomes "Current plan". */
  currentTier?: string;
}

/** Billing switch + the two upgrade buttons. Prices are read from
 * data/plans.ts, the same source the /pricing cards use. */
export function UpgradeModalActions({
  currency, period, onPeriodChange, onSelect, currentTier,
}: UpgradeModalActionsProps) {
  const annual = period === "annual";
  const pro = getPlan("pro");
  const ultra = getPlan("ultra");

  // Buttons always quote a monthly figure; annual quotes the effective
  // per-month rate so the two billing modes stay comparable.
  const perMonth = (id: PlanId) => {
    const plan = getPlan(id);
    if (!plan) return "";
    const amount = annual ? periodPrice(plan, currency, "annual") / 12 : listPrice(plan, currency);
    return formatPrice(amount, currency);
  };

  return (
    <>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs">
        <span className={cn(!annual && "font-medium text-foreground")}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Bill annually"
          onClick={() => onPeriodChange(annual ? "monthly" : "annual")}
          className={cn("relative h-5 w-9 rounded-full transition-colors", annual ? "bg-accent" : "bg-muted")}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              annual ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
        <span className={cn(annual && "font-medium text-foreground")}>
          Yearly <span className="text-green-500">({ANNUAL_DISCOUNT_PCT}% off)</span>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
            : `Upgrade to ${pro?.name ?? "Pro"} — ${perMonth("pro")}/mo`}
        </button>
        <button
          type="button"
          onClick={() => onSelect("ultra")}
          disabled={currentTier === "ultra"}
          className={cn(
            "flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-500 transition-colors",
            currentTier === "ultra" ? "cursor-not-allowed opacity-60" : "hover:bg-amber-500/20"
          )}
        >
          {currentTier === "ultra"
            ? "Current plan"
            : `Go ${ultra?.name ?? "Ultra"} — ${perMonth("ultra")}/mo`}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">Cancel anytime.</p>
    </>
  );
}
