"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { AuthShell, Field, FormAlert, SubmitButton, TextInput } from "@/components/auth/AuthShell";
import { register as registerRequest } from "@/services/auth";
import { establishSession, API_BASE } from "@/lib/session";
import { safeRedirect } from "@/lib/redirect";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  isClean,
  type FieldError,
} from "@/lib/validation";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan");
  // ?plan=pro|business continues to checkout; ?plan=free (or none) just
  // lands in the app -- free needs no payment step.
  const redirectTo = safeRedirect(
    params.get("redirect"),
    plan && plan !== "free" ? `/checkout?plan=${encodeURIComponent(plan)}` : "/home"
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const nextErrors = {
        email: validateEmail(email),
        password: validatePassword(password),
        confirm: validateConfirmPassword(password, confirm),
      };
      setErrors(nextErrors);
      if (!isClean(nextErrors)) return;

      setLoading(true);
      try {
        const data = await registerRequest(email.trim(), password, fullName.trim() || undefined);
        if (!data?.access_token) throw new Error("No token received from the server.");
        establishSession(data.user, data.access_token);
        router.replace(redirectTo);
      } catch (err: any) {
        const message = String(err?.message || "");
        if (message.toLowerCase().includes("already registered")) {
          setErrors((prev) => ({ ...prev, email: "That email already has an account. Sign in instead." }));
        } else if (message.toLowerCase().includes("failed to fetch")) {
          setFormError("Can't reach the server. Check your connection and try again.");
        } else {
          setFormError(message || "Could not create your account. Try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, confirm, fullName, redirectTo, router]
  );

  const oauth = (provider: "google" | "github" | "microsoft") => {
    window.location.assign(`${API_BASE}/auth/${provider}/login`);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        plan && plan !== "free"
          ? `You'll continue to checkout for the ${plan} plan after signing up.`
          : "Start free. No credit card required."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/login${redirectTo !== "/home" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-emerald-400 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {formError && <FormAlert kind="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="fullName" label="Full name (optional)">
          <TextInput
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>

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

        <Field
          id="password"
          label="Password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
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

        <Field id="confirm" label="Confirm password" error={errors.confirm}>
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

        <SubmitButton loading={loading}>{loading ? "Creating account…" : "Create account"}</SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">or continue with</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["google", "github", "microsoft"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => oauth(p)}
            className="rounded-xl border border-white/10 py-2.5 text-xs font-medium capitalize text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {p}
          </button>
        ))}
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Create your account">
      <div className="h-48 animate-pulse rounded-xl bg-white/5" />
    </AuthShell>}>
      <SignupForm />
    </Suspense>
  );
}
