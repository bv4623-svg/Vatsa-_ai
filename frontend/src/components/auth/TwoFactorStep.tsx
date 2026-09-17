"use client";

import { useCallback, useState } from "react";
import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { verifyLogin2FA } from "@/services/auth";

/** Shown after login() returns requires_2fa instead of a token -- the
 * account has real TOTP 2FA enabled, so a password alone can't finish
 * sign-in. Accepts either a live TOTP code or a one-time backup code,
 * since verify-login on the backend tries both. */
export function TwoFactorStep({
  pendingToken,
  onBack,
  onVerified,
}: {
  pendingToken: string;
  onBack: () => void;
  onVerified: (accessToken: string, user: unknown) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!code.trim()) {
        setError("Enter your 6-digit code or a backup code.");
        return;
      }
      setLoading(true);
      try {
        const data = await verifyLogin2FA(pendingToken, code.trim());
        onVerified(data.access_token, data.user);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message || "Invalid code." : "Invalid code.");
      } finally {
        setLoading(false);
      }
    },
    [code, pendingToken, onVerified]
  );

  return (
    <AuthShell title="Two-factor authentication" subtitle="Enter the code from your authenticator app, or a backup code.">
      {error && <FormAlert kind="error">{error}</FormAlert>}
      <form onSubmit={handleVerify} noValidate className="space-y-4">
        <Field id="totp-code" label="Verification code">
          <TextInput
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <SubmitButton loading={loading}>{loading ? "Verifying…" : "Verify"}</SubmitButton>
      </form>
      <button type="button" onClick={onBack} className="mt-4 text-xs text-zinc-400 hover:text-emerald-400">
        Back to sign in
      </button>
    </AuthShell>
  );
}
