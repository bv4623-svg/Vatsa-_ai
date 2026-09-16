import type { Conversation } from "@/types";

export const normalizeConv = (c: any): Conversation => {
  const id = c?.id ?? c?.conversation_id ?? c?._id;
  return {
    ...c,
    id: String(id),
    title: c?.title || "New Chat",
    messages: Array.isArray(c?.messages) ? c.messages : [],
    updatedAt: c?.updatedAt || c?.updated_at || c?.createdAt || new Date().toISOString(),
    pinned: !!c?.pinned,
    favorite: !!c?.favorite,
    archived: !!c?.archived,
  } as Conversation;
};

export const dedupeConversations = (convs: Conversation[]): Conversation[] => {
  const map = new Map<string, Conversation>();
  convs.forEach(c => map.set(String(c.id), { ...c, id: String(c.id) } as Conversation));
  return Array.from(map.values());
};
