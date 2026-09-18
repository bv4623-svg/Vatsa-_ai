/** Never reflect an arbitrary request Origin back with
 * Access-Control-Allow-Credentials: true -- that combination lets any
 * website on the internet make credentialed cross-origin requests through
 * this proxy and read the response. Only an origin on this explicit
 * allowlist is ever echoed back. */
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (!fromEnv) return DEFAULT_ALLOWED_ORIGINS;
  return fromEnv.split(",").map((o) => o.trim()).filter(Boolean);
}

/** Returns the Origin header value to echo back, or null if the
 * requesting origin isn't on the allowlist (caller should then omit the
 * CORS headers entirely rather than fall back to a wildcard). */
export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  return allowedOrigins().includes(requestOrigin) ? requestOrigin : null;
}
