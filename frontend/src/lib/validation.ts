/** Field-level validators for the auth forms. Zod is not a dependency of
 * this project, so these are plain functions returning a message or null.
 * Rules mirror the backend (app/routers/auth/schemas.py): register needs
 * >= 6 chars, password reset needs >= 8. */

export type FieldError = string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): FieldError {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address, like you@example.com.";
  return null;
}

export function validatePassword(value: string, min = 12): FieldError {
  if (!value) return "Enter your password.";
  if (value.length < min) return `Password must be at least ${min} characters.`;
  if (!/[a-zA-Z]/.test(value)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  return null;
}

/** Sign-in only checks presence -- strength rules belong on the account
 * being created, not on an existing password being typed back. */
export function validateRequired(value: string, label: string): FieldError {
  if (!value.trim()) return `Enter your ${label}.`;
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): FieldError {
  if (!confirm) return "Re-enter your password.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export function validateOtp(value: string): FieldError {
  const otp = value.trim();
  if (!otp) return "Enter the 6-digit code we emailed you.";
  if (!/^\d{6}$/.test(otp)) return "The code is 6 digits.";
  return null;
}

/** True when every value in the map is null. */
export function isClean(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).every((e) => e == null);
}
