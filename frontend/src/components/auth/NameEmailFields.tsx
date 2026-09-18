"use client";

import { Field, TextInput } from "@/components/auth/AuthShell";
import type { FieldError } from "@/lib/validation";

export function NameEmailFields({
  fullName,
  email,
  onFullNameChange,
  onEmailChange,
  emailError,
}: {
  fullName: string;
  email: string;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  emailError?: FieldError;
}) {
  return (
    <>
      <Field id="fullName" label="Full name (optional)">
        <TextInput
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
        />
      </Field>

      <Field id="email" label="Email address" error={emailError}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={emailError}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </Field>
    </>
  );
}
