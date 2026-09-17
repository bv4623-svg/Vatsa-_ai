/** Mirrors Backend app/models/library_item.py's to_dict() exactly.
 * Every field here is a real, persisted value -- there is no client-side
 * derived/estimated field in this type. */

export type LibraryItemType = "chat" | "document" | "code" | "artifact" | "upload" | "generated" | "folder";

export interface LibraryItem {
  id: string;
  userId: number;
  type: LibraryItemType;
  name: string;
  sizeBytes: number;
  mime: string | null;
  parentId: string | null;
  isFolder: boolean;
  tags: string[];
  sourceTable: string | null;
  sourceId: string | null;
  hasFile: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItemsPage {
  items: LibraryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface StorageBreakdown {
  chat: number;
  document: number;
  code: number;
  artifact: number;
  upload: number;
  generated: number;
}

export interface StorageUsage {
  used_bytes: number;
  limit_bytes: number;
  used_gb: number;
  limit_gb: number;
  percent: number;
  at_warning: boolean;
  at_limit: boolean;
  breakdown: StorageBreakdown;
}

export type LibrarySortKey = "date" | "name" | "size";
export type SortOrder = "asc" | "desc";
export type LibraryViewMode = "grid" | "list";

/** The exact 402/413/429-style payload the backend raises for a storage
 * ceiling hit, shared with the upgrade modal's limitInfo shape. */
export interface StorageLimitError {
  error: "storage_limit_reached";
  used_bytes: number;
  limit_bytes: number;
  upgrade_url: string;
}
