import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { ConnectedAccount, ConnectionProvider } from "@/types/account";

export async function listConnections(): Promise<ConnectedAccount[]> {
  const res = await fetch(`${API_BASE}/api/account/connections`, { headers: authHeaders() });
  const data = await parseOrThrow<{ items: ConnectedAccount[] }>(res);
  return data.items;
}

export async function startConnectionLink(provider: ConnectionProvider): Promise<string> {
  const res = await fetch(`${API_BASE}/api/account/connections/${provider}/start`, { headers: authHeaders() });
  const data = await parseOrThrow<{ url: string }>(res);
  return data.url;
}

export async function unlinkConnection(provider: ConnectionProvider): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/connections/${provider}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}
