"use client";

import { useEffect, useState } from "react";
import { setup2FA, enable2FA } from "@/lib/account-client";

/** Real TOTP setup: fetches a server-generated secret + QR (never a
 * third-party QR API), waits for the user to enter a code their
 * authenticator app actually computed, then reveals the one-time backup
 * codes returned by /enable -- these are never shown again after this. */
export function TwoFactorSetupFlow({ onEnabled }: { onEnabled: () => void }) {
  const [qr, setQr] = useState<{ secret: string; qrDataUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setup2FA().then(setQr).catch((err) => setError(err instanceof Error ? err.message : "Could not start setup."));
  }, []);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await enable2FA(code.trim());
      setBackupCodes(result.backupCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  if (backupCodes) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Save your backup codes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Each code can be used once to sign in if you lose access to your authenticator app. They will not be shown again.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg bg-input/10 p-3 font-mono text-xs text-foreground">
          {backupCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <button
          onClick={onEnabled}
          className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      {qr ? (
        <>
          <p className="text-sm font-medium text-foreground">Scan this QR code</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URI, not an optimizable remote image */}
          <img src={qr.qrDataUri} alt="Two-factor authentication QR code" className="my-3 h-40 w-40 rounded-lg border border-border" />
          <p className="text-xs text-muted-foreground">Or enter this key manually: <span className="font-mono">{qr.secret}</span></p>
          <form onSubmit={handleEnable} className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-32 rounded-lg border border-border bg-input/10 px-3 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Enable"}
            </button>
          </form>
        </>
      ) : (
        !error && <p className="text-sm text-muted-foreground">Setting up…</p>
      )}
    </div>
  );
}
