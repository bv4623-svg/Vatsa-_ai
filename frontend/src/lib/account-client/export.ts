import { API_BASE } from "@/lib/session";
import { authHeaders } from "@/lib/api-client/shared";

/** Bearer-authenticated like every other account route, so a bare <a href>
 * can't carry the header -- fetch as a blob and click a synthetic link
 * instead, same pattern as library-client/sharing.ts's downloadItem(). */
export async function downloadAccountExport(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/export`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] || "vatsa-export.zip";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
