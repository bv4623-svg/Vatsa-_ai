import { API_BASE } from "@/config/api";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";

export const REVIEW_TAGS = ["quality", "speed", "price", "support", "coding", "images", "research", "ui"] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];
export type ReviewSort = "recent" | "top" | "helpful";
export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";
export type VoteType = "helpful" | "not_helpful";
export type ReportReason = "spam" | "offensive" | "off_topic" | "fake" | "other";

export const TAG_LABELS: Record<ReviewTag, string> = {
  quality: "Answer quality", speed: "Speed", price: "Price", support: "Support",
  coding: "Coding", images: "Images", research: "Research", ui: "Design",
};
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or advertising" },
  { value: "offensive", label: "Abusive or offensive" },
  { value: "off_topic", label: "Not about Vatsa AI" },
  { value: "fake", label: "Fake or misleading" },
  { value: "other", label: "Something else" },
];
export const BODY_MIN = 20;
export const BODY_MAX = 5000;
export const MAX_POINTS = 5;

export interface ReviewReply { id: number; body: string; is_owner: boolean; author_name: string; created_at: string }

export interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  pros: string[];
  cons: string[];
  tags: ReviewTag[];
  is_verified: boolean;
  is_featured: boolean;
  is_public: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  edited: boolean;
  author: { id: number; name: string };
  replies: ReviewReply[];
  is_mine: boolean;
  my_vote: VoteType | null;
  pinned: boolean;
  status?: ReviewStatus;
  moderation_note?: string | null;
  appealed?: boolean;
  author_email?: string | null;
  spam_score?: number;
  report_count?: number;
  appeal_message?: string | null;
  open_reports?: { id: number; reason: ReportReason; details: string | null; created_at: string }[];
  banned?: "shadow" | "full" | null;
}

export interface ReviewStats {
  count: number;
  average: number | null;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  sentiment: Record<"positive" | "neutral" | "negative", number>;
}

export interface ReviewPage { items: Review[]; next_cursor: string | null; featured?: Review[]; stats?: ReviewStats }

export interface ReviewSummary {
  stats: ReviewStats;
  top_tags: { tag: ReviewTag; count: number }[];
  top_pros: { text: string; count: number }[];
  top_cons: { text: string; count: number }[];
  text: string | null;
  generated_by: "ai" | "stats" | null;
}

export interface ReviewFilters { rating?: number; tag?: ReviewTag | ""; verified?: boolean; days?: number; q?: string; sort?: ReviewSort }

export interface ReviewInput {
  rating: number;
  title?: string;
  body: string;
  pros: string[];
  cons: string[];
  tags: ReviewTag[];
  is_public: boolean;
}

export interface WallPinItem { review_id: number; is_public: boolean; position: number; review: Review | null }

/** Problems with a draft review as typed, keyed by field; empty when it can be sent. */
export function reviewErrors(input: ReviewInput): Partial<Record<"rating" | "body" | "title" | "pros" | "cons", string>> {
  const errors: Partial<Record<"rating" | "body" | "title" | "pros" | "cons", string>> = {};
  if (!(input.rating >= 1 && input.rating <= 5)) errors.rating = "Choose a rating from 1 to 5 stars.";
  const length = input.body.trim().length;
  if (length < BODY_MIN) errors.body = `Please write at least ${BODY_MIN} characters.`;
  else if (length > BODY_MAX) errors.body = `Please keep it under ${BODY_MAX} characters.`;
  if ((input.title ?? "").trim().length > 200) errors.title = "Keep the title under 200 characters.";
  for (const key of ["pros", "cons"] as const) {
    const items = input[key].map((p) => p.trim()).filter(Boolean);
    if (items.length > MAX_POINTS) errors[key] = `Up to ${MAX_POINTS} items.`;
    else if (items.some((p) => p.length > 120)) errors[key] = "Keep each item under 120 characters.";
  }
  return errors;
}

export function reviewPayload(input: ReviewInput) {
  const points = (items: string[]) => [...new Set(items.map((p) => p.trim()).filter(Boolean))];
  return {
    rating: input.rating,
    title: input.title?.trim() || null,
    body: input.body.trim(),
    pros: points(input.pros),
    cons: points(input.cons),
    tags: input.tags,
    is_public: input.is_public,
  };
}

export function filterParams(filters: ReviewFilters, cursor?: string | null, limit = 12): URLSearchParams {
  const params = new URLSearchParams({ limit: String(limit), sort: filters.sort ?? "recent" });
  if (filters.rating) params.set("rating", String(filters.rating));
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.verified) params.set("verified", "true");
  if (filters.days) params.set("days", String(filters.days));
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (cursor) params.set("cursor", cursor);
  return params;
}

const json = { "Content-Type": "application/json" };
const get = async <T,>(path: string) => parseOrThrow<T>(await fetch(`${API_BASE}${path}`, { headers: authHeaders() }));
const send = async <T,>(method: string, path: string, body?: unknown) =>
  parseOrThrow<T>(await fetch(`${API_BASE}${path}`, { method, headers: { ...json, ...authHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) }));
const sendEmpty = async (method: string, path: string) => {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: authHeaders() });
  if (!res.ok) await parseOrThrow(res);
};

export const fetchWall = (filters: ReviewFilters, cursor?: string | null) => get<ReviewPage>(`/api/wall/public?${filterParams(filters, cursor)}`);
export const fetchSummary = () => get<ReviewSummary>("/api/reviews/summary");
export const fetchMyReviews = () => get<{ items: Review[] }>("/api/reviews/mine");
export const fetchMyWall = () => get<{ user_id: number; items: WallPinItem[] }>("/api/wall/me");
export const fetchUserWall = (userId: number) => get<{ user: { id: number; name: string }; items: Review[] }>(`/api/users/${userId}/wall`);
export const fetchSimilar = (id: number) => get<{ items: Review[] }>(`/api/reviews/${id}/similar`);

export const createReview = (input: ReviewInput) => send<Review>("POST", "/api/reviews", reviewPayload(input));
export const updateReview = (id: number, input: ReviewInput) => send<Review>("PATCH", `/api/reviews/${id}`, reviewPayload(input));
export const deleteReview = (id: number) => sendEmpty("DELETE", `/api/reviews/${id}`);
export const voteReview = (id: number, vote_type: VoteType) =>
  send<{ helpful_count: number; not_helpful_count: number; my_vote: VoteType | null }>("POST", `/api/reviews/${id}/vote`, { vote_type });
export const reportReview = (id: number, reason: ReportReason, details?: string) => send<{ reported: true }>("POST", `/api/reviews/${id}/report`, { reason, details });
export const replyToReview = (id: number, body: string) => send<Review>("POST", `/api/reviews/${id}/reply`, { body });
export const appealReview = (id: number, message: string) => send<Review>("POST", `/api/reviews/${id}/appeal`, { message });
export const pinReview = (id: number, is_public = false) => send<{ pinned: true; is_public: boolean }>("POST", `/api/reviews/${id}/pin`, { is_public });
export const unpinReview = (id: number) => sendEmpty("DELETE", `/api/reviews/${id}/pin`);
export const reorderWall = (review_ids: number[]) => send<{ review_ids: number[] }>("PUT", "/api/wall/me/order", { review_ids });

export const fetchModerationQueue = (status: ReviewStatus | "" = "pending") =>
  get<{ items: Review[]; total: number; counts: Record<ReviewStatus | "open_reports", number> }>(`/api/admin/reviews?limit=200${status ? `&status=${status}` : ""}`);
export const moderateReview = (id: number, change: { status?: ReviewStatus; note?: string; featured?: boolean }) =>
  send<Review>("PATCH", `/api/admin/reviews/${id}/status`, change);
export const banUser = (userId: number, mode: "shadow" | "full", reason?: string) => send<{ user_id: number; mode: string }>("POST", `/api/admin/users/${userId}/ban`, { mode, reason });
export const unbanUser = (userId: number) => sendEmpty("DELETE", `/api/admin/users/${userId}/ban`);
