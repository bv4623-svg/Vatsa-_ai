import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "./shared";
import type { LibraryItem, LibraryItemsPage, LibrarySortKey, SortOrder } from "@/types/library";

export interface ListItemsParams {
  type?: string;
  parentId?: string | null;
  search?: string;
  tag?: string;
  sort?: LibrarySortKey;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export async function listItems(params: ListItemsParams = {}): Promise<LibraryItemsPage> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.parentId !== undefined) qs.set("parent_id", params.parentId ?? "");
  if (params.search) qs.set("search", params.search);
  if (params.tag) qs.set("tag", params.tag);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("page_size", String(params.pageSize));

  const res = await fetch(`${API_BASE}/api/library/items?${qs.toString()}`, { headers: authHeaders() });
  return parseOrThrow(res);
}

export async function createFolder(name: string, parentId?: string | null): Promise<LibraryItem> {
  const res = await fetch(`${API_BASE}/api/library/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, parent_id: parentId ?? null }),
  });
  return parseOrThrow(res);
}

export async function updateItem(
  id: string,
  patch: { name?: string; parentId?: string | null; tags?: string[] }
): Promise<LibraryItem> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name: patch.name, parent_id: patch.parentId, tags: patch.tags }),
  });
  return parseOrThrow(res);
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/library/items/${id}`, { method: "DELETE", headers: authHeaders() });
  await parseOrThrow(res);
}

export async function bulkDelete(ids: string[]): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/api/library/items/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ids }),
  });
  return parseOrThrow(res);
}

export async function bulkMove(ids: string[], parentId: string | null): Promise<{ moved: number }> {
  const res = await fetch(`${API_BASE}/api/library/items/bulk-move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ids, parent_id: parentId }),
  });
  return parseOrThrow(res);
}
