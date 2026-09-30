import { API_BASE } from "@/config/api";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { Message } from "@/types";

/** 👍/👎 on assistant replies, saved on the server so they survive a reload
 * (Backend/app/routers/chat_feedback.py). */
export type Vote = "up" | "down";
export type VoteReason = "wrong" | "unhelpful" | "too_long" | "unsafe" | "other";

/** Quick-pick reasons offered after a thumbs-down (fixed codes, no free text). */
export const VOTE_REASONS: { code: VoteReason; label: string }[] = [
  { code: "wrong", label: "Wrong or made up" },
  { code: "unhelpful", label: "Didn't answer" },
  { code: "too_long", label: "Too long" },
  { code: "unsafe", label: "Unsafe" },
  { code: "other", label: "Other" },
];

export interface SavedVote {
  conversation_id: string;
  message_id: string;
  rating: Vote;
  reason: VoteReason | null;
}

/** The id a vote is saved under: the id the reply was stored with on the
 * server. Null for replies that weren't saved (auto-save off), which keep a
 * browser-only vote as before. */
export function savedReplyId(msg: Pick<Message, "id" | "role" | "serverId">): string | null {
  if (msg.role !== "assistant") return null;
  if (msg.serverId) return msg.serverId;
  return msg.id.startsWith("msg_") ? msg.id : null;
}

/** Clicking the thumb that's already on clears the vote. */
export function nextVote(current: Vote | null | undefined, clicked: Vote): Vote | null {
  return current === clicked ? null : clicked;
}

export async function rateReply(conversationId: string, messageId: string, rating: Vote, reason?: VoteReason): Promise<SavedVote> {
  const res = await fetch(`${API_BASE}/api/chat/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, rating, reason: reason ?? null }),
  });
  return parseOrThrow<SavedVote>(res);
}

export async function clearReplyRating(conversationId: string, messageId: string): Promise<void> {
  const q = new URLSearchParams({ conversation_id: conversationId, message_id: messageId });
  const res = await fetch(`${API_BASE}/api/chat/feedback?${q}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}

export async function myRatings(conversationId: string): Promise<SavedVote[]> {
  const q = new URLSearchParams({ conversation_id: conversationId });
  const res = await fetch(`${API_BASE}/api/chat/feedback?${q}`, { headers: authHeaders() });
  return (await parseOrThrow<{ items: SavedVote[] }>(res)).items;
}

export interface RatingStats {
  days: number;
  total: number;
  up: number;
  down: number;
  satisfaction: number | null;
  by_day: { date: string; up: number; down: number }[];
  top_reasons: { reason: VoteReason; count: number }[];
  down_without_reason: number;
}

export async function ratingStats(days = 30): Promise<RatingStats> {
  const res = await fetch(`${API_BASE}/api/admin/chat-feedback/stats?days=${days}`, { headers: authHeaders() });
  return parseOrThrow<RatingStats>(res);
}

export function reasonLabel(code: string): string {
  return VOTE_REASONS.find((r) => r.code === code)?.label ?? code;
}
