import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ScheduledTask, ScheduledTasksPage } from "@/types/scheduled-task";

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
}

export interface CreateTaskInput {
  title: string;
  prompt: string;
  schedule: string;
  timezone: string;
  model?: string | null;
  notifyEmail: boolean;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export async function listTasks(params: ListTasksParams = {}): Promise<ScheduledTasksPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("page_size", String(params.pageSize));
  const res = await fetch(`${API_BASE}/api/scheduled-tasks?${qs.toString()}`, { headers: authHeaders() });
  return parseOrThrow(res);
}

export async function createTask(input: CreateTaskInput): Promise<ScheduledTask> {
  const res = await fetch(`${API_BASE}/api/scheduled-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res);
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<ScheduledTask> {
  const res = await fetch(`${API_BASE}/api/scheduled-tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return parseOrThrow(res);
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/scheduled-tasks/${id}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}
