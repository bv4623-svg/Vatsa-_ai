import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ChatProject } from "@/types/chat-project";

export async function addProjectChat(projectId: string, conversationId: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ conversationId }),
  });
  return parseOrThrow(res);
}

export async function removeProjectChat(projectId: string, conversationId: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/chats/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseOrThrow(res);
}

export async function addProjectFile(projectId: string, itemId: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ itemId }),
  });
  return parseOrThrow(res);
}

export async function removeProjectFile(projectId: string, itemId: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseOrThrow(res);
}
