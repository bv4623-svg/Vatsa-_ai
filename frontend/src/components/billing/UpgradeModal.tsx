"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useCurrency } from "@/hooks/useCurrency";
import { FeatureComparisonTable } from "./FeatureComparisonTable";
import { UpgradeModalActions } from "./UpgradeModalActions";
import type { BillingPeriod, PlanId } from "@/data/plans";

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: string;
  feature?: string;
  suggestedTier?: "pro" | "ultra";
  showComparison?: boolean;
  limitInfo?: { used: number; limit: number };
}

export function UpgradeModal({
  open, onClose, reason, feature, suggestedTier = "pro", showComparison = true, limitInfo,
}: UpgradeModalProps) {
  const router = useRouter();
  const [currency] = useCurrency();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  // Same destination the pricing page cards use, so a plan picked here and
  // a plan picked there land on an identically-priced checkout.
  const goToCheckout = (planId: PlanId) => {
    onClose();
    const from = feature ? `&from=${encodeURIComponent(feature)}` : "";
    router.push(`/checkout?plan=${planId}&billing=${period}&currency=${currency}${from}`);
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" className="max-w-2xl">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Unlock {feature ? feature.charAt(0).toUpperCase() + feature.slice(1).replace(/_/g, " ") : "Pro features"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
        {limitInfo && (
          <p className="mt-2 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            You&apos;ve used {limitInfo.used} of {limitInfo.limit} today
          </p>
        )}
      </div>

      {showComparison && <FeatureComparisonTable highlight={suggestedTier} />}

      <UpgradeModalActions
        currency={currency}
        period={period}
        onPeriodChange={setPeriod}
        onSelect={goToCheckout}
      />
    </Modal>
  );
}
