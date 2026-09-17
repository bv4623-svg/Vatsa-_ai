"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { login as loginRequest } from "@/services/auth";
import { establishSession } from "@/lib/session";
import { validateEmail, validateRequired, isClean, type FieldError } from "@/lib/validation";

export function LoginPasswordStep({
  redirectTo,
  onRequires2FA,
  onSuccess,
}: {
  redirectTo: string;
  onRequires2FA: (pendingToken: string) => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const nextErrors = { email: validateEmail(email), password: validateRequired(password, "password") };
      setErrors(nextErrors);
      if (!isClean(nextErrors)) return;

      setLoading(true);
      try {
        const data = await loginRequest(email.trim(), password);
        if ("requires_2fa" in data) {
          onRequires2FA(data.pending_token);
          return;
        }
        if (!data.access_token) throw new Error("No token received from the server.");
        establishSession(data.user, data.access_token);
        onSuccess();
      } catch (err: any) {
        const message = String(err?.message || "");
        if (message.toLowerCase().includes("failed to fetch")) {
          setFormError("Can't reach the server. Check your connection and try again.");
        } else if (message.toLowerCase().includes("deactivated")) {
          setFormError("This account has been deactivated. Contact support to restore it.");
        } else {
          setFormError(message || "Incorrect email or password.");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, onRequires2FA, onSuccess]
  );

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New to Vatsa AI?{" "}
          <Link
            href={`/signup${redirectTo !== "/home" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-emerald-400 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {formError && <FormAlert kind="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

        <Field id="password" label="Password" error={errors.password}>
          <div className="relative">
            <TextInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-zinc-400 hover:text-emerald-400">
            Forgot password?
          </Link>
        </div>

        <SubmitButton loading={loading}>{loading ? "Signing in…" : "Continue"}</SubmitButton>
      </form>

      <OAuthButtons />
    </AuthShell>
  );
}
