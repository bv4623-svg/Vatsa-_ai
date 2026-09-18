"use client";

import { X, Zap } from "lucide-react";
import { useUpgrade } from "./UpgradeProvider";
import { formatBothPrices, getPlan } from "@/data/plans";

interface UpgradeBannerProps {
  onDismiss: () => void;
}

/** Dismissible nudge shown above the composer after N free-tier
 * messages -- reappears later (see dismiss-count logic in the caller),
 * not a one-time-forever dismiss. */
export function UpgradeBanner({ onDismiss }: UpgradeBannerProps) {
  const { openUpgrade } = useUpgrade();
  const pro = getPlan("pro");
  const proPrice = pro ? formatBothPrices(pro) : "";
  return (
    <div className="mx-auto mb-2 flex w-full max-w-[760px] items-center justify-between gap-3 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 to-purple-500/10 px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 flex-shrink-0 text-accent" />
        <span className="text-foreground/80">
          Enjoying Vatsa AI? Unlock Vision, Reasoning, Agents, and 1000s more messages.
        </span>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={() => openUpgrade({ source: "chat_footer", reason: "Unlock higher daily limits, Vision, Reasoning and Agents." })}
          className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 font-medium text-white"
        >
          Upgrade to Pro — {proPrice}/mo
        </button>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
