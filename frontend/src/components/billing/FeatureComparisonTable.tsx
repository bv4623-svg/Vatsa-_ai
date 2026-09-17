"use client";

import { Check, X as XIcon, Crown, Star, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_MATRIX, type PlanId } from "@/data/plans";

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-green-500" aria-label="Included" />
    ) : (
      <XIcon className="mx-auto h-4 w-4 text-muted-foreground/30" aria-label="Not included" />
    );
  }
  return <span>{value}</span>;
}

const COLUMNS: { id: PlanId; label: string; icon?: React.ReactNode }[] = [
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro", icon: <Star className="h-3.5 w-3.5" /> },
  { id: "business", label: "Business", icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: "ultra", label: "Ultra", icon: <Crown className="h-3.5 w-3.5" /> },
];

/** Every cell for every plan comes from FEATURE_MATRIX, so the modal can
 * never show a blank column or disagree with the pricing page cards. */
export function FeatureComparisonTable({ highlight }: { highlight?: PlanId }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="py-2 text-left font-medium text-muted-foreground">Feature</th>
            {COLUMNS.map((col) => (
              <th
                key={col.id}
                className={cn(
                  "py-2 text-center font-medium",
                  highlight === col.id ? "text-accent" : "text-muted-foreground"
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.icon}
                  {col.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((row) => (
            <tr key={row.label} className="border-b border-border/20">
              <td className="py-2 text-foreground/80">{row.label}</td>
              {COLUMNS.map((col) => (
                <td key={col.id} className="py-2 text-center">
                  <Cell value={row.values[col.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
