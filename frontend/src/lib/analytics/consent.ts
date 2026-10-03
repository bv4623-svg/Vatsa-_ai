/** The visitor's cookie choice, kept in localStorage by CookieBanner. Analytics
 * is opt-in: nothing loads until it is explicitly accepted. */

export const CONSENT_STORAGE_KEY = "cookie-consent";
/** Fired on window whenever the choice is saved. */
export const CONSENT_CHANGE_EVENT = "vatsa:cookie-consent";
/** Fired on window to reopen the cookie settings (the Cookie Policy page's button). */
export const OPEN_COOKIE_SETTINGS_EVENT = "vatsa:open-cookie-settings";

export type ConsentStatus = "accepted" | "rejected" | "customized";

export interface StoredConsent {
  status: ConsentStatus;
  analytics: boolean;
}

export function parseConsent(raw: string): StoredConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.status === "accepted" || parsed?.status === "rejected" || parsed?.status === "customized") {
      // Older saves kept every category under `preferences`; only analytics matters now.
      return { status: parsed.status, analytics: parsed.preferences?.analytics === true || parsed.analytics === true };
    }
  } catch {
    // A plain string from the first version of the banner.
    if (raw === "accepted") return { status: "accepted", analytics: true };
    if (raw === "rejected") return { status: "rejected", analytics: false };
  }
  return null;
}

/** The stored string ("" when nothing is saved). A string keeps
 * useSyncExternalStore's snapshot stable between reads. */
export function consentSnapshot(): string {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** For useSyncExternalStore: this tab's saves plus other tabs' (storage event). */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function hasAnalyticsConsent(): boolean {
  return parseConsent(consentSnapshot())?.analytics === true;
}

export function saveConsent(consent: StoredConsent): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage blocked: nothing persists, so the banner asks again next visit.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
