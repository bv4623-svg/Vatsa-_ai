"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, X as XIcon, Crown, Star } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: string;
  feature?: string;
  suggestedTier?: "pro" | "ultra";
  showComparison?: boolean;
  limitInfo?: { used: number; limit: number };
}

type Row = { label: string; free: string | boolean; pro: string | boolean; ultra: string | boolean };

const ROWS: Row[] = [
  { label: "Chat messages/day", free: "25", pro: "2,000", ultra: "Unlimited" },
  { label: "Code messages/day", free: "3", pro: "500", ultra: "Unlimited" },
  { label: "Image generation/day", free: "20", pro: "200", ultra: "500" },
  { label: "Web search/day", free: "5", pro: "500", ultra: "5,000" },
  { label: "Vision (image analysis)", free: false, pro: true, ultra: true },
  { label: "Voice (text-to-speech)", free: false, pro: true, ultra: true },
  { label: "Reasoning mode", free: false, pro: true, ultra: true },
  { label: "Custom agents", free: false, pro: true, ultra: true },
  { label: "Canvas documents", free: false, pro: true, ultra: true },
  { label: "Code sandbox", free: false, pro: true, ultra: true },
  { label: "Priority queue", free: false, pro: true, ultra: true },
  { label: "Deep research", free: false, pro: false, ultra: true },
  { label: "Vatsa Ultra model", free: false, pro: false, ultra: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value
      ? <Check className="mx-auto h-4 w-4 text-green-500" />
      : <XIcon className="mx-auto h-4 w-4 text-muted-foreground/30" />;
  }
  return <span>{value}</span>;
}

export function UpgradeModal({
  open, onClose, reason, feature, suggestedTier = "pro", showComparison = true, limitInfo,
}: UpgradeModalProps) {
  const router = useRouter();
  const [yearly, setYearly] = useState(false);

  const proPrice = yearly ? 399 : 499;
  const ultraPrice = yearly ? 1199 : 1499;

  const goToPricing = (tier: "pro" | "ultra") => {
    onClose();
    router.push(`/pricing?plan=${tier}${yearly ? "&billing=yearly" : ""}${feature ? `&from=${feature}` : ""}`);
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

      {showComparison && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="py-2 text-left font-medium text-muted-foreground">Feature</th>
                <th className="py-2 text-center font-medium text-muted-foreground">Free</th>
                <th className={cn("py-2 text-center font-medium", suggestedTier === "pro" ? "text-accent" : "text-muted-foreground")}>
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Pro</span>
                </th>
                <th className={cn("py-2 text-center font-medium", suggestedTier === "ultra" ? "text-amber-500" : "text-muted-foreground")}>
                  <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" /> Ultra</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border/20">
                  <td className="py-2 text-foreground/80">{row.label}</td>
                  <td className="py-2 text-center"><Cell value={row.free} /></td>
                  <td className="py-2 text-center"><Cell value={row.pro} /></td>
                  <td className="py-2 text-center"><Cell value={row.ultra} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs">
        <span className={cn(!yearly && "font-medium text-foreground")}>Monthly</span>
        <button
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((v) => !v)}
          className={cn("relative h-5 w-9 rounded-full transition-colors", yearly ? "bg-accent" : "bg-muted")}
        >
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", yearly ? "translate-x-4.5 left-0.5" : "left-0.5")} />
        </button>
        <span className={cn(yearly && "font-medium text-foreground")}>Yearly <span className="text-green-500">(20% off)</span></span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => goToPricing("pro")}
          className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          Upgrade to Pro — ₹{proPrice}/mo
        </button>
        <button
          onClick={() => goToPricing("ultra")}
          className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/20"
        >
          Go Ultra — ₹{ultraPrice}/mo
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">Cancel anytime.</p>
    </Modal>
  );
}
