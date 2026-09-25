export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
export type FontSize = "small" | "medium" | "large";

export type AttachmentStatus = "processing" | "ready" | "error";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  isBase64: boolean;
  status: AttachmentStatus;
  preview?: string;
  /** Set once the real POST /api/upload round-trip completes -- the file
   * is persisted (Library row, counts toward storage quota, survives a
   * refresh) at this point, not just held in browser memory. */
  progress?: number;
  fileId?: string;
  url?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
}
