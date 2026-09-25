"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { sendOtp, verifyOtp } from "@/services/auth";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { validateEmail, validateOtp, isClean, type FieldError } from "@/lib/validation";

type Step = "email" | "code";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { remaining, isCoolingDown, start: startCooldown } = useResendCooldown();

  const requestCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isCoolingDown) return;
      setFormError(null);
      setNotice(null);

      const nextErrors = { email: validateEmail(email) };
      setErrors(nextErrors);
      if (!isClean(nextErrors)) return;

      setLoading(true);
      try {
        await sendOtp(email.trim(), "reset");
        setStep("code");
        setNotice(`We sent a 6-digit code to ${email.trim()}. It expires in 5 minutes.`);
        startCooldown();
      } catch (err: any) {
        setFormError(String(err?.message || "Could not send the reset code. Try again."));
      } finally {
        setLoading(false);
      }
    },
    [email, isCoolingDown, startCooldown]
  );

  const submitCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const nextErrors = { otp: validateOtp(otp) };
      setErrors(nextErrors);
      if (!isClean(nextErrors)) return;

      setLoading(true);
      try {
        const data = await verifyOtp(email.trim(), otp.trim());
        if (!data?.reset_token) throw new Error("That code is no longer valid. Request a new one.");
        // The reset token is short-lived (10 min) and single-purpose, and
        // sessionStorage keeps it out of the URL and out of history.
        sessionStorage.setItem("vatsa_reset", JSON.stringify({ email: email.trim(), token: data.reset_token }));
        router.push("/reset-password");
      } catch (err: any) {
        setFormError(String(err?.message || "Could not verify that code."));
      } finally {
        setLoading(false);
      }
    },
    [email, otp, router]
  );

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        step === "email"
          ? "We'll email you a 6-digit code to confirm it's you."
          : "Enter the code we just emailed you."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-emerald-400 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {formError && <FormAlert kind="error">{formError}</FormAlert>}
      {notice && !formError && <FormAlert kind="success">{notice}</FormAlert>}

      {step === "email" ? (
        <form onSubmit={requestCode} noValidate className="space-y-4">
          <Field id="email" label="Email address" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <SubmitButton loading={loading}>{loading ? "Sending code…" : "Send reset code"}</SubmitButton>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate className="space-y-4">
          <Field id="otp" label="6-digit code" error={errors.otp}>
            <TextInput
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              error={errors.otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="tracking-[0.4em]"
            />
          </Field>

          <SubmitButton loading={loading}>{loading ? "Verifying…" : "Verify code"}</SubmitButton>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setFormError(null); setNotice(null); }}
              className="text-zinc-400 hover:text-white"
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={loading || isCoolingDown}
              className="text-emerald-400 hover:underline disabled:opacity-50"
            >
              {isCoolingDown ? `Resend code (${remaining}s)` : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
