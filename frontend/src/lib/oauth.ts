import { API_BASE } from "@/config/api";
import { safeRedirect } from "@/lib/redirect";

export type OAuthProvider = "google" | "github";

/** The provider sends the user back to /auth/callback with only a token, so
 * the page to open afterwards (e.g. /checkout?plan=pro from pricing) is kept
 * in this tab's sessionStorage for the round trip. */
const AFTER_SIGN_IN = "vatsa:after-sign-in";

export function startOAuth(provider: OAuthProvider, redirectTo = "/home") {
  const next = safeRedirect(redirectTo);
  try {
    if (next === "/home") sessionStorage.removeItem(AFTER_SIGN_IN);
    else sessionStorage.setItem(AFTER_SIGN_IN, next);
  } catch {
    // Storage blocked: sign-in still works, it just lands on /home.
  }
  window.location.assign(`${API_BASE}/api/auth/${provider}/login`);
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
