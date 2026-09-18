"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { resetPassword } from "@/services/auth";
import { validatePassword, validateConfirmPassword, isClean, type FieldError } from "@/lib/validation";

/** Read once, lazily: sessionStorage is only available in the browser, so
 * this runs on the first client render rather than during SSR. */
function readResetGrant(): { email: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("vatsa_reset");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.email && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

const subscribeNoop = () => () => {};

export default function ResetPasswordPage() {
  const router = useRouter();
  // The grant lives in sessionStorage, which only exists on the client.
  // `mounted` keeps the hydration render identical to the server render,
  // so the grant-dependent UI only appears once we're safely client-side.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [grant] = useState(readResetGrant);
  const ready = mounted;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!grant) return;
      setFormError(null);

      const nextErrors = {
        password: validatePassword(password),
        confirm: validateConfirmPassword(password, confirm),
      };
      setErrors(nextErrors);
      if (!isClean(nextErrors)) return;

      setLoading(true);
      try {
        await resetPassword(grant.email, password, grant.token);
        sessionStorage.removeItem("vatsa_reset");
        setDone(true);
        setTimeout(() => router.replace("/login"), 2500);
      } catch (err: any) {
        setFormError(String(err?.message || "Could not reset your password. Request a new code."));
      } finally {
        setLoading(false);
      }
    },
    [grant, password, confirm, router]
  );

  if (!ready) {
    return (
      <AuthShell title="Choose a new password">
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </AuthShell>
    );
  }

  if (!grant) {
    return (
      <AuthShell
        title="Start again"
        subtitle="This reset link is missing or has expired."
        footer={
          <Link href="/login" className="font-medium text-emerald-400 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <FormAlert kind="error">
          Password reset codes are valid for a few minutes. Request a fresh one to continue.
        </FormAlert>
        <Link
          href="/forgot-password"
          className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
        >
          Request a new code
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can sign in with your new password now.">
        <FormAlert kind="success">Taking you to sign in…</FormAlert>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
        >
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`Resetting the password for ${grant.email}.`}>
      {formError && <FormAlert kind="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="password"
          label="New password"
          error={errors.password}
          hint="At least 12 characters, with a letter and a number."
        >
          <div className="relative">
            <TextInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field id="confirm" label="Confirm new password" error={errors.confirm}>
          <TextInput
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            error={errors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <SubmitButton loading={loading}>{loading ? "Updating…" : "Update password"}</SubmitButton>
      </form>
    </AuthShell>
  );
}
