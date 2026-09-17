import type { ThemePreference } from "@/config/settings";

export const THEME_COOKIE = "vatsa_theme";
export const THEME_STORAGE_KEY = "vatsa-theme";

export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Turns a preference into the theme actually painted. "system" needs the
 * media query, so this must run where `window` exists. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}

/** Written as a plain cookie (not httpOnly) so the server can render the
 * correct theme on the very first paint and the client can update it
 * without a round trip. It holds a display preference, nothing sensitive. */
export function persistThemeCookie(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${preference}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}

export function readStoredPreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // Storage blocked -- fall through to the cookie.
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const fromCookie = match ? decodeURIComponent(match[1]) : null;
  return isThemePreference(fromCookie) ? fromCookie : "system";
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Cookie below is still written, so the preference survives a reload.
  }
  persistThemeCookie(preference);
}

/** Inlined in <head> and run before first paint: without it the server's
 * guess for "system" can differ from the device and the page visibly
 * repaints from light to dark. */
export const THEME_BOOTSTRAP_SCRIPT = `
(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
var p=m?decodeURIComponent(m[1]):null;
try{var ls=localStorage.getItem('${THEME_STORAGE_KEY}');if(ls)p=ls;}catch(e){}
if(p!=='light'&&p!=='dark'&&p!=='system')p='system';
var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();
`.trim();
