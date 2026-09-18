"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, TextInput } from "@/components/auth/AuthShell";
import type { FieldError } from "@/lib/validation";

/** The password + confirm-password pair used by signup (and shareable by
 * any other "set a new password" screen) -- one show/hide toggle covers
 * both fields since they always hold the same value. */
export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  passwordError,
  confirmError,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  passwordError?: FieldError;
  confirmError?: FieldError;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Field id="password" label="Password" error={passwordError} hint="At least 12 characters, with a letter and a number.">
        <div className="relative">
          <TextInput
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            error={passwordError}
            onChange={(e) => onPasswordChange(e.target.value)}
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

      <Field id="confirm" label="Confirm password" error={confirmError}>
        <TextInput
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          error={confirmError}
          onChange={(e) => onConfirmChange(e.target.value)}
        />
      </Field>
    </>
  );
}
