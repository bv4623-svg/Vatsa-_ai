import { getToken } from "@/lib/auth";
import { describeApiError } from "@/lib/api-client/errors";

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(describeApiError(body, res.status));
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { status?: number; body?: unknown }).body = body?.detail ?? body;
    throw err;
  }
  return res.json();
}
