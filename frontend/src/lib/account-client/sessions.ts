import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import { setToken } from "@/lib/auth";

/** Revokes every other device's access token via a token_version bump,
 * then swaps in the fresh token the backend issues for THIS device so
 * calling it doesn't also sign the caller out. */
export async function signOutOtherDevices(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/sessions/sign-out-others`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await parseOrThrow<{ access_token: string }>(res);
  setToken(data.access_token);
}
