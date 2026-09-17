"use client";

import { useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { useConnectedAccounts } from "@/hooks/account";
import type { ConnectionProvider } from "@/types/account";

const PROVIDERS: { id: ConnectionProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
];

export function ConnectedAccountsTab() {
  const { connections, loading, startLink, unlink } = useConnectedAccounts();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (provider: ConnectionProvider) => {
    setError(null);
    try {
      await startLink(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start linking.");
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && PROVIDERS.map(({ id, label }) => {
        const connection = connections.find((c) => c.provider === id);
        return (
          <div key={id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{connection ? connection.email || "Connected" : "Not connected"}</p>
            </div>
            {connection ? (
              <button
                onClick={() => void unlink(id)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent/5"
              >
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </button>
            ) : (
              <button
                onClick={() => void handleConnect(id)}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
              >
                <Link2 className="h-3.5 w-3.5" /> Connect
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
