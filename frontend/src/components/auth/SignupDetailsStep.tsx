"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { AuthShell, FormAlert, SubmitButton } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordFields } from "@/components/auth/PasswordFields";
import { NameEmailFields } from "@/components/auth/NameEmailFields";
import { register } from "@/services/auth";
import { describeSignupError } from "@/lib/auth-errors";
import { validateEmail, validatePassword, validateConfirmPassword, isClean, type FieldError } from "@/lib/validation";

export function SignupDetailsStep({
  planSubtitle,
  loginHref,
  onRegistered,
}: {
  planSubtitle: string;
  loginHref: string;
  onRegistered: (accessToken: string, user: unknown) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
        const data = await register(email.trim(), password, fullName.trim() || undefined);
        onRegistered(data.access_token, data.user);
      } catch (err: any) {
        const { emailError, formError: nextFormError } = describeSignupError(String(err?.message || ""));
        if (emailError) setErrors((prev) => ({ ...prev, email: emailError }));
        if (nextFormError) setFormError(nextFormError);
      } finally {
        setLoading(false);
      }
    },
    [email, password, confirm, fullName, onRegistered]
  );

  const footer = (
    <>
      Already have an account? <Link href={loginHref} className="font-medium text-emerald-400 hover:underline">Sign in</Link>
    </>
  );

  return (
    <AuthShell title="Create your account" subtitle={planSubtitle} footer={footer}>
      {formError && <FormAlert kind="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <NameEmailFields
          fullName={fullName}
          email={email}
          onFullNameChange={setFullName}
          onEmailChange={setEmail}
          emailError={errors.email}
        />

        <PasswordFields
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          passwordError={errors.password}
          confirmError={errors.confirm}
        />

        <SubmitButton loading={loading}>{loading ? "Creating account…" : "Continue"}</SubmitButton>
      </form>

      <OAuthButtons />
    </AuthShell>
  );
}
