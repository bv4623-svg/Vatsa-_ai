/** Only allow same-origin, path-style redirects after sign-in.
 * Anything absolute ("https://evil.example") or protocol-relative
 * ("//evil.example") falls back, so ?redirect= can't be used to bounce a
 * freshly authenticated user off-site. */
export function safeRedirect(value: string | null | undefined, fallback = "/home"): string {
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  const target = decoded.trim();
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//")) return fallback;
  if (target.startsWith("/\\")) return fallback;

  return target;
}
