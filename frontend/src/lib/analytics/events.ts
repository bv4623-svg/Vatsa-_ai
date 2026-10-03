import { analyticsAllowedHere } from "./config";
import { hasAnalyticsConsent } from "./consent";

export type AuthMethod = "email" | "google" | "github" | "oauth";

/** Every event the app sends, with its parameters. Never add personal data
 * here: no email, name, prompt text, file names or conversation ids.
 * sign_up and login are GA4's recommended event names. */
interface EventParams {
  sign_up: { method: AuthMethod };
  login: { method: AuthMethod };
  chat_message: { workspace: "chat" | "code" };
  generate_image: Record<string, never>;
  create_code_project: Record<string, never>;
  upgrade_click: { source: string; feature: string | null; suggested_tier: string | null };
}

type Gtag = (...args: unknown[]) => void;

/** Sends one GA4 event. Does nothing without analytics consent or off the
 * live site. GA loads a moment after the page does (and not at all on the
 * sign-in callback, see components/analytics/Analytics.tsx), so an event
 * fired before that waits for it, up to 15 s, instead of being lost. */
export function track<E extends keyof EventParams>(name: E, params: EventParams[E]): void {
  if (!analyticsAllowedHere() || !hasAnalyticsConsent()) return;
  const send = () => {
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (typeof gtag !== "function") return false;
    gtag("event", name, params);
    return true;
  };
  if (send()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    if (send() || ++tries >= 150) window.clearInterval(timer);
  }, 100);
}

/* ─── Which OAuth provider started a sign-in ─────────────────────────
   The callback page can't tell Google from GitHub, so the button that
   starts the flow notes it for this tab. */

const OAUTH_PROVIDER_KEY = "vatsa_oauth_provider";

export function rememberOAuthProvider(provider: "google" | "github"): void {
  try {
    sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
  } catch {
    // Storage blocked: the event falls back to method "oauth".
  }
}

export function takeOAuthProvider(): AuthMethod {
  try {
    const value = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
    if (value === "google" || value === "github") return value;
  } catch {
    // Fall through.
  }
  return "oauth";
}
