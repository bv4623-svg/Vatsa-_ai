"use client";

import { useBilling } from "@/hooks/account";

const STATUS_COLOR: Record<string, string> = {
  paid: "text-green-500",
  success: "text-green-500",
  pending: "text-yellow-500",
  failed: "text-red-500",
};

export function BillingTab() {
  const { billing, loading } = useBilling();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Current plan</p>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">{billing?.tier ?? "free"}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Invoices</p>
        <div className="mt-2 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && (billing?.invoices.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
          {billing?.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm capitalize text-foreground">{inv.plan}</p>
                <p className="text-xs text-muted-foreground">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "--"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-foreground">{inv.amount ? `${inv.amount} ${inv.currency}` : "--"}</p>
                <p className={`text-xs capitalize ${STATUS_COLOR[inv.status] ?? "text-muted-foreground"}`}>{inv.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
