"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { UpgradeModal } from "./UpgradeModal";
import type { PlanId } from "@/data/plans";

/** Where the upgrade was triggered from. Sent with the analytics event so we
 * can tell which surface actually converts. */
export type UpgradeSource =
  | "sidebar"
  | "sidebar_collapsed"
  | "message_limit"
  | "settings"
  | "chat_footer"
  | "quota_banner"
  | "chat_header"
  | "code_header"
  | "code_preview"
  | "feature_lock";

export interface OpenUpgradeArgs {
  source: UpgradeSource;
  reason?: string;
  feature?: string;
  suggestedTier?: Extract<PlanId, "pro" | "business">;
  limitInfo?: { used: number; limit: number };
}

interface UpgradeContextValue {
  openUpgrade: (args: OpenUpgradeArgs) => void;
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

interface GateState extends OpenUpgradeArgs {
  open: boolean;
}

const CLOSED: GateState = { open: false, source: "sidebar" };

/** One modal instance for the whole app. Every upgrade CTA calls openUpgrade
 * instead of routing to /pricing on its own, so there is a single place that
 * decides what the user sees and a single price source behind it. */
export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<GateState>(CLOSED);

  const openUpgrade = useCallback((args: OpenUpgradeArgs) => {
    trackUpgradeIntent(args);
    setGate({ ...args, open: true });
  }, []);

  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <UpgradeModal
        open={gate.open}
        onClose={() => setGate((g) => ({ ...g, open: false }))}
        source={gate.source}
        reason={gate.reason ?? "Unlock higher limits and every Pro feature."}
        feature={gate.feature}
        suggestedTier={gate.suggestedTier}
        limitInfo={gate.limitInfo}
      />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade(): UpgradeContextValue {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used inside <UpgradeProvider>");
  return ctx;
}

/** Fires a client analytics event if one is wired up; stays silent otherwise
 * rather than pretending an analytics pipeline exists. */
function trackUpgradeIntent(args: OpenUpgradeArgs) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...a: unknown[]) => void;
  };
  const payload = {
    event: "upgrade_intent",
    source: args.source,
    feature: args.feature ?? null,
    suggested_tier: args.suggestedTier ?? null,
  };
  if (Array.isArray(w.dataLayer)) w.dataLayer.push(payload);
  if (typeof w.gtag === "function") w.gtag("event", "upgrade_intent", payload);
}
