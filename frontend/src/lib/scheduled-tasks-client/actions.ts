import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ScheduledTask } from "@/types/scheduled-task";

async function postAction<T>(id: string, action: "pause" | "resume" | "run-now"): Promise<T> {
  const res = await fetch(`${API_BASE}/api/scheduled-tasks/${id}/${action}`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}

export const pauseTask = (id: string) => postAction<ScheduledTask>(id, "pause");
export const resumeTask = (id: string) => postAction<ScheduledTask>(id, "resume");
export const runTaskNow = (id: string) => postAction<{ status: string }>(id, "run-now");
