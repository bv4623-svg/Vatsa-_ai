import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ChatProject } from "@/types/chat-project";

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  systemPrompt?: string | null;
  instructions?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export async function listProjects(archived?: boolean): Promise<ChatProject[]> {
  const qs = archived === undefined ? "" : `?archived=${archived}`;
  const res = await fetch(`${API_BASE}/api/projects${qs}`, { headers: authHeaders() });
  const data = await parseOrThrow<{ items: ChatProject[] }>(res);
  return data.items;
}

export async function getProject(id: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { headers: authHeaders() });
  return parseOrThrow(res);
}

export async function createProject(input: CreateProjectInput): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res);
}

export async function updateProject(id: string, patch: UpdateProjectInput): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return parseOrThrow(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}

export async function archiveProject(id: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/archive`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}

export async function unarchiveProject(id: string): Promise<ChatProject> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/unarchive`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}
