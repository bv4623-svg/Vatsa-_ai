// Page routes that must NOT be proxied (frontend lives here)
export const FRONTEND_PAGE_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth",           // fallback — /auth/page.tsx
];

// Backend-only paths (even under /auth)
export const BACKEND_AUTH_PREFIXES = [
  "/auth/otp",
  "/auth/register",
  "/auth/reset-password",
  "/auth/onboarding",
  "/auth/token",
  "/auth/google",
  "/auth/github",
  "/auth/microsoft",
  "/auth/me",
  "/auth/logout",
  "/auth/refresh",
];

// Pages that require a signed-in user. The bearer token in localStorage is
// still the authority (the backend validates the JWT on every API call);
// the vatsa_session cookie only lets us bounce anonymous visitors here
// instead of flashing an empty authed shell first.
export const PROTECTED_PREFIXES = ["/home", "/code", "/workspace", "/checkout", "/billing", "/settings", "/library", "/scheduled", "/projects"];

export function isBackendAuthPath(path: string) {
  return BACKEND_AUTH_PREFIXES.some((p) => path.startsWith(p));
}

export function isFrontendPage(path: string) {
  // exact match only (so /auth/login/foo still goes to backend if not defined)
  return FRONTEND_PAGE_PREFIXES.some((p) => path === p);
}

export function isProtectedPage(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
