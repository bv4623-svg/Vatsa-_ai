"use client";

import { useCallback, useState } from "react";
import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { verifyOtp, resendOtp, register as registerRequest } from "@/services/auth";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import type { SignupDetails } from "@/components/auth/SignupDetailsStep";

export function SignupVerifyStep({
  details,
  onBack,
  onRegistered,
}: {
  details: SignupDetails;
  onBack: () => void;
  onRegistered: (accessToken: string, user: unknown) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { remaining, isCoolingDown, start: startCooldown } = useResendCooldown();

  const handleVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!code.trim()) {
        setError("Enter the code we sent to your email.");
        return;
      }
      setLoading(true);
      try {
        const otpResult = await verifyOtp(details.email, code.trim());
        if (!otpResult.verification_token) throw new Error("Verification failed. Try again.");

        const data = await registerRequest(details.email, details.password, details.fullName || undefined, otpResult.verification_token);
        if (!data.access_token) throw new Error("No token received from the server.");
        onRegistered(data.access_token, data.user);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message || "Invalid code." : "Invalid code.");
      } finally {
        setLoading(false);
      }
    },
    [code, details, onRegistered]
  );

  const handleResend = async () => {
    if (isCoolingDown) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendOtp(details.email, "signup");
      setInfo("A new code is on its way.");
      startCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell title="Verify your email" subtitle={`Enter the code we sent to ${details.email}.`}>
      {error && <FormAlert kind="error">{error}</FormAlert>}
      {info && <FormAlert kind="success">{info}</FormAlert>}
      <form onSubmit={handleVerify} noValidate className="space-y-4">
        <Field id="signup-otp" label="Verification code">
          <TextInput
            id="signup-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <SubmitButton loading={loading}>{loading ? "Verifying…" : "Create account"}</SubmitButton>
      </form>
      <div className="mt-4 flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="text-zinc-400 hover:text-emerald-400">
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resending || isCoolingDown}
          className="text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
        >
          {resending ? "Resending…" : isCoolingDown ? `Resend code (${remaining}s)` : "Resend code"}
        </button>
      </div>
    </AuthShell>
  );
}
