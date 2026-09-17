import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { TwoFactorSetup, TwoFactorEnableResult } from "@/types/account";

export async function setup2FA(): Promise<TwoFactorSetup> {
  const res = await fetch(`${API_BASE}/api/account/2fa/setup`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}

export async function enable2FA(code: string): Promise<TwoFactorEnableResult> {
  const res = await fetch(`${API_BASE}/api/account/2fa/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code }),
  });
  return parseOrThrow(res);
}

export async function disable2FA(password: string): Promise<{ enabled: boolean }> {
  const res = await fetch(`${API_BASE}/api/account/2fa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ password }),
  });
  return parseOrThrow(res);
}
