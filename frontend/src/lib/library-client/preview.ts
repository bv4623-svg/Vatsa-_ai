import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "./shared";

export interface MessagePreview {
  kind: "messages";
  title: string;
  workspace: string;
  messages: { role: string; content: string; createdAt?: string }[];
}
export interface ImagePreview { kind: "image"; url: string }
export interface FilePreview { kind: "file"; mime: string | null; text: string | null }
export interface FolderPreview { kind: "folder" }
export interface UnsupportedPreview { kind: "unsupported" }

export type ItemPreview = MessagePreview | ImagePreview | FilePreview | FolderPreview | UnsupportedPreview;

export async function getItemPreview(id: string): Promise<ItemPreview> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}/preview`, { headers: authHeaders() });
  return parseOrThrow(res);
}
