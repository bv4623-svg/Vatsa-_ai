import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";

export async function deleteAccount(password: string): Promise<{ deleted: boolean; gracePeriodDays: number }> {
  const res = await fetch(`${API_BASE}/api/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ password, confirm: true }),
  });
  return parseOrThrow(res);
}
