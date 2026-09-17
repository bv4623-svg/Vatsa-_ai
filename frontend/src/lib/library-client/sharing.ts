import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "./shared";
import type { LibraryItem } from "@/types/library";

/** Public, deliberately unauthenticated -- the token itself is the
 * credential (see Backend app/routers/library/sharing.py). */
export async function getSharedItem(token: string): Promise<LibraryItem & { previewUrl?: string }> {
  const res = await fetch(`${API_BASE}/api/library/share/${token}`);
  return parseOrThrow(res);
}

export async function shareItem(id: string): Promise<{ share_token: string; url: string }> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}/share`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}

export async function unshareItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}/share`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}

/** The download endpoint is Bearer-authenticated like every other Library
 * route, so a bare <a href> can't carry the header and a token-in-URL
 * would leak into browser history and server logs. Fetching as a blob
 * and clicking a synthetic link keeps the token in the Authorization
 * header where it belongs. */
export async function downloadItem(id: string, suggestedName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}/download`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] || suggestedName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
