import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";

/** A minimal, clean shape for the project chat-picker -- deliberately not
 * reusing services/chat.ts's Conversation type, which carries several
 * pre-existing `any` fields unrelated to this feature. */
export interface ProjectPickerChat {
  id: string;
  title: string;
  workspace: string;
  projectId: string | null;
  updatedAt: string;
}

interface RawConversation {
  id: string;
  title: string;
  workspace?: string;
  projectId?: string | null;
  updatedAt?: string;
  updated_at?: string;
}

export async function listAllChats(): Promise<ProjectPickerChat[]> {
  const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() });
  const data = await parseOrThrow<RawConversation[]>(res);
  return data.map((c) => ({
    id: c.id,
    title: c.title,
    workspace: c.workspace || "chat",
    projectId: c.projectId ?? null,
    updatedAt: c.updatedAt || c.updated_at || "",
  }));
}
