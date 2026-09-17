import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "./shared";
import type { StorageUsage } from "@/types/library";

export async function getStorageUsage(): Promise<StorageUsage> {
  const res = await fetch(`${API_BASE}/api/library/storage`, { headers: authHeaders() });
  return parseOrThrow(res);
}
