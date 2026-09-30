/** Cloudflare Turnstile on the Google/GitHub sign-in buttons (/login and
 * /signup share them) -- the only CAPTCHA in the app. The backend enforces
 * it when TURNSTILE_ENABLED is on (Backend/app/services/captcha.py); set
 * this site key in the same deploy, or sign-in is refused. Empty = no
 * widget, buttons work as before. Inlined at build time. */
export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();

export interface CaptchaState {
  token: string | null;
  /** The widget couldn't run (script blocked, network, Cloudflare error). */
  failed: boolean;
}

export type CaptchaEvent = { type: "verified"; token: string } | { type: "expired" } | { type: "failed" };

export const NO_CAPTCHA_YET: CaptchaState = { token: null, failed: false };

export function captchaReducer(state: CaptchaState, event: CaptchaEvent): CaptchaState {
  switch (event.type) {
    case "verified":
      return { token: event.token, failed: false };
    case "expired":
      // Tokens last 5 minutes; the widget fetches a fresh one on its own.
      return { token: null, failed: false };
    case "failed":
      return { token: null, failed: true };
  }
}

/** The buttons may start a sign-in: no CAPTCHA configured, or a token in hand. */
export function canStartSignIn(siteKey: string, state: CaptchaState): boolean {
  return !siteKey || state.token !== null;
}
