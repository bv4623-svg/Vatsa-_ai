"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Sparkles } from "lucide-react";
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import { useApiKeys } from "@/hooks/account";
import type { ApiKeyCreated } from "@/types/account";

export function ApiKeysTab({ isFree }: { isFree: boolean }) {
  const { openUpgrade } = useUpgrade();
  const { keys, loading, create, revoke } = useApiKeys();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isFree) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-accent" />
        <div className="flex-1 text-sm text-foreground/80">API keys let you call Vatsa AI programmatically. Available on Pro and above.</div>
        <button
          onClick={() => openUpgrade({ source: "settings", feature: "api_keys", reason: "Unlock API keys and every Pro feature." })}
          className="shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setCreated(await create(name.trim()));
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the key. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await revoke(id);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the key. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  };

  return (
    <div className="space-y-4">
      {created && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
          <p className="text-xs text-muted-foreground">Copy this key now -- it won&apos;t be shown again.</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-input/10 px-2 py-1 text-xs text-foreground">{created.key}</code>
            <button onClick={() => void copyKey()} className="tap-target flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy API key"}>
              {copied === "copied" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {copied === "failed" && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Couldn&apos;t copy. Select the key and copy it manually.</p>}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. CI pipeline)"
          className="flex-1 rounded-lg border border-border bg-input/10 px-3 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
        />
        <button type="submit" disabled={!name.trim() || busy} className="rounded-lg bg-accent-solid px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
          Create key
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && keys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm text-foreground">{k.name}</p>
              <p className="text-xs text-muted-foreground">
                {k.keyPrefix}••••••• {k.revoked ? "· revoked" : k.lastUsedAt ? `· last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "· never used"}
              </p>
            </div>
            {!k.revoked && confirmId !== k.id && (
              <button onClick={() => { setError(null); setConfirmId(k.id); }} className="tap-target flex items-center justify-center text-muted-foreground hover:text-red-500" aria-label={`Revoke ${k.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {!k.revoked && confirmId === k.id && (
              <div role="group" aria-label={`Confirm revoking ${k.name}`} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Apps using it stop working.</span>
                <button onClick={() => setConfirmId(null)} disabled={busy} className="tap-target rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent/10">
                  Cancel
                </button>
                <button onClick={() => void handleRevoke(k.id)} disabled={busy} className="tap-target rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                  {busy ? "Revoking…" : "Revoke key"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
