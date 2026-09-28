import { API_BASE } from "@/config/api";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";

export type FeedbackType = "bug" | "feature" | "praise" | "other";
export type FeedbackStatus = "new" | "read" | "resolved";

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 5000;

export interface FeedbackInput {
  type: FeedbackType;
  message: string;
  rating?: number | null;
  email?: string;
  pageUrl?: string;
}

export interface FeedbackItem {
  id: number;
  user_id: number | null;
  email: string | null;
  type: FeedbackType;
  message: string;
  rating: number | null;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: string;
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  counts: Record<FeedbackStatus, number>;
}

/** The problem with a message as typed, or null when it can be sent. */
export function feedbackMessageError(message: string): string | null {
  const length = message.trim().length;
  if (length < MESSAGE_MIN) return `Please write at least ${MESSAGE_MIN} characters.`;
  if (length > MESSAGE_MAX) return `Please keep it under ${MESSAGE_MAX} characters.`;
  return null;
}

export function feedbackPayload(input: FeedbackInput) {
  return {
    type: input.type,
    message: input.message.trim(),
    rating: input.rating ?? null,
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.pageUrl && /^https?:\/\//.test(input.pageUrl) ? { page_url: input.pageUrl.slice(0, 2048) } : {}),
  };
}

export async function submitFeedback(input: FeedbackInput): Promise<{ id: number; status: FeedbackStatus }> {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(feedbackPayload(input)),
  });
  return parseOrThrow(res);
}

export async function listFeedback(filters: { status?: FeedbackStatus | ""; type?: FeedbackType | "" } = {}): Promise<FeedbackPage> {
  const params = new URLSearchParams({ limit: "200" });
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  const res = await fetch(`${API_BASE}/api/feedback?${params}`, { headers: authHeaders() });
  return parseOrThrow(res);
}

export async function updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<FeedbackItem> {
  const res = await fetch(`${API_BASE}/api/feedback/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  return parseOrThrow(res);
}
