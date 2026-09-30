import { API_BASE } from "@/config/api";
import { safeRedirect } from "@/lib/redirect";

export type OAuthProvider = "google" | "github";

/** The provider sends the user back to /auth/callback with only a token, so
 * the page to open afterwards (e.g. /checkout?plan=pro from pricing) is kept
 * in this tab's sessionStorage for the round trip. */
const AFTER_SIGN_IN = "vatsa:after-sign-in";

/** Name of the field the backend reads the Turnstile token from
 * (Backend/app/services/captcha.py TOKEN_FIELD). */
export const CAPTCHA_FIELD = "cf-turnstile-response";

export function startOAuth(provider: OAuthProvider, redirectTo = "/home", captchaToken: string | null = null) {
  const next = safeRedirect(redirectTo);
  try {
    if (next === "/home") sessionStorage.removeItem(AFTER_SIGN_IN);
    else sessionStorage.setItem(AFTER_SIGN_IN, next);
  } catch {
    // Storage blocked: sign-in still works, it just lands on /home.
  }
  // A form POST, not a link: the CAPTCHA token travels in the body, never
  // in a URL (access logs keep query strings). The backend answers 303 to
  // Google/GitHub.
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${API_BASE}/api/auth/${provider}/login`;
  if (captchaToken) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = CAPTCHA_FIELD;
    field.value = captchaToken;
    form.appendChild(field);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Where to go once sign-in completes. Re-checked with safeRedirect because
 * anything in storage can be edited. */
export function afterSignIn(): string {
  try {
    return safeRedirect(sessionStorage.getItem(AFTER_SIGN_IN));
  } catch {
    return "/home";
  }
}

export function forgetAfterSignIn() {
  try {
    sessionStorage.removeItem(AFTER_SIGN_IN);
  } catch {
    // Nothing stored if storage is blocked.
  }
}
