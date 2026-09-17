"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff, Monitor } from "lucide-react";
import { useUser, useAuthActions } from "@/stores/auth";
import { disable2FA, signOutOtherDevices } from "@/lib/account-client";
import { TwoFactorSetupFlow } from "@/components/settings/TwoFactorSetupFlow";

export function SecurityTab() {
  const user = useUser();
  const { updateUser } = useAuthActions();
  const enabled = Boolean(user?.twoFactorEnabled);
  const [settingUp, setSettingUp] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedOutOthers, setSignedOutOthers] = useState(false);

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await disable2FA(password);
      updateUser({ twoFactorEnabled: false });
      setDisabling(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutOthers = async () => {
    setBusy(true);
    try {
      await signOutOtherDevices();
      setSignedOutOthers(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-4 w-4 text-green-500" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
          <label className="text-sm font-medium text-foreground">Two-factor authentication</label>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {enabled ? "Enabled -- a code from your authenticator app is required to sign in." : "Add an extra step to sign-in using an authenticator app."}
        </p>

        <div className="mt-3">
          {enabled ? (
            disabling ? (
              <form onSubmit={handleDisable} className="flex flex-wrap items-center gap-2">
                {error && <p className="w-full text-xs text-red-500">{error}</p>}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-56 rounded-lg border border-border bg-input/10 px-3 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
                />
                <button type="submit" disabled={busy} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50">
                  Confirm disable
                </button>
                <button type="button" onClick={() => setDisabling(false)} className="text-sm text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </form>
            ) : (
              <button onClick={() => setDisabling(true)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent/5">
                Disable 2FA
              </button>
            )
          ) : settingUp ? (
            <TwoFactorSetupFlow onEnabled={() => { updateUser({ twoFactorEnabled: true }); setSettingUp(false); }} />
          ) : (
            <button onClick={() => setSettingUp(true)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90">
              Enable 2FA
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">Sign out of other devices</label>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Ends every other active session. This device stays signed in.</p>
        <button
          onClick={() => void handleSignOutOthers()}
          disabled={busy}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent/5 disabled:opacity-50"
        >
          {signedOutOthers ? "Done -- other sessions signed out" : "Sign out other devices"}
        </button>
      </div>
    </div>
  );
}
