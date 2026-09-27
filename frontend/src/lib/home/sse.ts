/**
 * Incremental parser for the backend's server-sent events (one JSON object
 * per `data:` line). Handles events split across network chunks and
 * multi-byte characters split across chunk boundaries.
 */
export interface ChatStreamEvent {
  delta?: string;
  thinking?: string;
  notice?: string;
  stage?: "planning" | "searching" | "writing";
  queries?: string[];
  source_count?: number;
  error?: string;
  code?: string;
  retryable?: boolean;
  done?: boolean;
  sources?: unknown[];
  [key: string]: unknown;
}

export function createSseParser(onEvent: (evt: ChatStreamEvent) => void) {
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (raw: string) => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload);
      onEvent(typeof parsed === "string" ? { delta: parsed } : parsed);
    } catch {
      // A non-JSON data line is plain text from an older server.
      onEvent({ delta: payload });
    }
  };

  return {
    feed(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(handleLine);
    },
    end() {
      buffer += decoder.decode();
      if (buffer) handleLine(buffer);
      buffer = "";
    },
  };
}

/** Human progress line for a deep-research stage event. */
export function researchStageLabel(evt: ChatStreamEvent): string | null {
  switch (evt.stage) {
    case "planning":
      return "Planning research…";
    case "searching":
      return `Searching the web (${evt.queries?.length ?? 0} queries)…`;
    case "writing":
      return `Reading ${evt.source_count ?? 0} sources and writing the report…`;
    default:
      return null;
  }
}

/** Friendly text for a failed request, never raw JSON or a stack. */
export function describeHttpError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail.length < 300) return detail;
  if (status === 401 || status === 403) return "Your session expired. Please sign in again.";
  if (status === 413) return "That message or attachment is too large.";
  if (status === 422) return "The request was invalid. Try shortening your message.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status === 502 || status === 503 || status === 504) return "AI service is temporarily unavailable. Please try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return `Request failed (HTTP ${status}).`;
}

export function describeNetworkError(err: unknown, online: boolean): string {
  if (!online) return "You're offline. Check your connection and try again.";
  if (err instanceof TypeError) return "Couldn't reach Vatsa AI. Check your connection and try again.";
  return err instanceof Error && err.message ? err.message : "Unknown error";
}
