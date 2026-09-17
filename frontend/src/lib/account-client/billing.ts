import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { BillingSummary } from "@/types/account";

export async function getBillingSummary(): Promise<BillingSummary> {
  const res = await fetch(`${API_BASE}/api/account/billing`, { headers: authHeaders() });
  return parseOrThrow(res);
}
