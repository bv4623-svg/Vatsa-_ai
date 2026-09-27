/** Turns any error body the API returns into one sentence a person can act
 * on. Raw codes ("storage_limit_reached"), FastAPI validation arrays,
 * HTML error pages from a proxy and long stack-trace-like strings are never
 * shown as-is. */

const MAX_DETAIL_LENGTH = 300;

const CODE_MESSAGES: Record<string, string> = {
  storage_limit_reached: "Your storage is full. Free up space or upgrade your plan.",
  upgrade_required: "This feature needs a paid plan.",
  daily_limit_reached: "You've reached today's daily limit. Try again tomorrow or upgrade your plan.",
};

function looksLikeHtml(text: string): boolean {
  return /<\s*(html|body|head|!doctype|div|h1)\b/i.test(text);
}

function usableText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_DETAIL_LENGTH || looksLikeHtml(trimmed)) return null;
  return trimmed;
}

function fromValidationErrors(detail: unknown[]): string | null {
  const first = detail[0] as { loc?: unknown[]; msg?: unknown } | undefined;
  const msg = usableText(first?.msg);
  if (!msg) return null;
  const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : undefined;
  return typeof field === "string" && field !== "body" ? `${field}: ${msg}` : msg;
}

function fromStatus(status: number, fallback?: string): string {
  if (status === 401 || status === 403) return "Your session expired. Please sign in again.";
  if (status === 402) return CODE_MESSAGES.upgrade_required;
  if (status === 404) return "That item no longer exists.";
  if (status === 413) return "That file or message is too large.";
  if (status === 422) return "The request was invalid. Check what you entered and try again.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status === 502 || status === 503 || status === 504) return "The service is temporarily unavailable. Please try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return fallback ?? `Request failed (HTTP ${status}).`;
}

export function describeApiError(body: unknown, status: number, fallback?: string): string {
  const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : body;

  if (typeof detail === "string") return usableText(detail) ?? fromStatus(status, fallback);
  if (Array.isArray(detail)) return fromValidationErrors(detail) ?? fromStatus(status, fallback);
  if (detail && typeof detail === "object") {
    const d = detail as { error?: unknown; message?: unknown };
    if (typeof d.error === "string" && CODE_MESSAGES[d.error]) return CODE_MESSAGES[d.error];
    const text = usableText(d.message);
    if (text) return text;
    // Other bodies: { message } (e.g. OAuth pages) or { error: "sentence" }.
    const plainError = usableText(d.error);
    if (plainError && /\s/.test(plainError)) return plainError;
  }
  return fromStatus(status, fallback);
}
