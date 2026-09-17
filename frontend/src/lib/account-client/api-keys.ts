import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ApiKey, ApiKeyCreated } from "@/types/account";

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await fetch(`${API_BASE}/api/account/api-keys`, { headers: authHeaders() });
  const data = await parseOrThrow<{ items: ApiKey[] }>(res);
  return data.items;
}

export async function createApiKey(name: string): Promise<ApiKeyCreated> {
  const res = await fetch(`${API_BASE}/api/account/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  return parseOrThrow(res);
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/api-keys/${id}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}
