import type { Attachment } from "@/types/home";
import { API_BASE } from "@/lib/home/constants";

/** Server-side limits mirrored here so the user gets an instant, specific
 * error instead of a slow upload followed by a generic failure. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // Backend/app/routers/upload.py
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_INLINE_TEXT_CHARS = 50_000;
export const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
/** Images are sent to the model as data URLs; the server refuses > 8 MB. */
export const MAX_IMAGE_SEND_BYTES = 8 * 1024 * 1024;
/** Long edge the model actually uses; larger images only cost bandwidth. */
export const IMAGE_MAX_DIMENSION = 1568;

const SERVER_EXTRACTED_RE = /\.(pdf|docx|xlsx|xlsm)$/i;
const TEXT_NAME_RE =
  /\.(txt|md|markdown|json|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|html|htm|css|scss|sass|xml|yaml|yml|csv|tsv|log|sh|bash|zsh|sql|kt|swift|dart|r|m|pl|lua|vue|svelte)$/i;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type FileKind = "document" | "text" | "image" | "unsupported";

export function classifyFile(file: { name: string; type: string }): FileKind {
  if (SERVER_EXTRACTED_RE.test(file.name)) return "document";
  if (file.type.startsWith("image/")) return SUPPORTED_IMAGE_TYPES.has(file.type) ? "image" : "unsupported";
  if (
    file.type.startsWith("text/") ||
    /(json|xml|javascript|typescript|csv|yaml|yml|markdown)$/i.test(file.type) ||
    TEXT_NAME_RE.test(file.name)
  ) {
    return "text";
  }
  return "unsupported";
}

/** Returns a user-facing reason the file can't be attached, or null. */
export function validateFile(file: { name: string; type: string; size: number }): string | null {
  const kind = classifyFile(file);
  if (file.size === 0) return "File is empty";
  if (kind === "unsupported") return "Unsupported file type. Use PDF, DOCX, XLSX, images (PNG/JPEG/WEBP/GIF) or text/code files.";
  if (kind === "document" && file.size > MAX_DOCUMENT_BYTES) return "Too large (max 25 MB)";
  if (kind === "text" && file.size > MAX_TEXT_FILE_BYTES) return "Too large for a text attachment (max 2 MB)";
  if (kind === "image" && file.size > MAX_IMAGE_INPUT_BYTES) return "Image too large (max 20 MB)";
  return null;
}

/** Turns any error body shape the API returns into one readable sentence. */
export function errorMessageFromBody(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const err = (detail as { error?: string }).error;
    if (err === "storage_limit_reached") return "Your storage is full. Free up space or upgrade.";
    if (err === "upgrade_required") return "This needs a paid plan.";
    if (err === "daily_limit_reached") return "Daily limit reached. Try again tomorrow.";
  }
  if (status === 401 || status === 403) return "Please sign in again.";
  if (status === 413) return "File too large.";
  if (status === 429) return "Too many uploads. Wait a minute and try again.";
  if (status >= 500) return "Server error. Try again shortly.";
  return `Upload failed (HTTP ${status})`;
}

export interface ExtractResult {
  text: string;
  truncated?: boolean;
  warning?: string | null;
  pages?: number;
  pages_parsed?: number;
}

async function extractViaServer(file: File): Promise<ExtractResult> {
  const token = localStorage.getItem("access_token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessageFromBody(body, res.status));
  }
  return res.json();
}

export function documentWarning(r: ExtractResult): string | undefined {
  if (r.warning) return r.warning;
  if (r.truncated) {
    return r.pages && r.pages_parsed && r.pages_parsed < r.pages
      ? `Only the first ${r.pages_parsed} of ${r.pages} pages were read`
      : "Long document: only the beginning was read";
  }
  return undefined;
}

/** Scales an image down to IMAGE_MAX_DIMENSION on its long edge and
 * re-encodes it (JPEG, or PNG when it may have transparency) so a 12 MP
 * phone photo becomes a few hundred KB instead of a 10+ MB request. GIFs
 * are passed through (re-encoding would drop animation). */
async function prepareImage(file: File): Promise<string> {
  const original = await readAsDataURL(file);
  if (file.type === "image/gif" || typeof createImageBitmap === "undefined") return original;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read this image");
  }
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return original;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return original;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  return canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.85);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}

export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.floor(((comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length) * 3) / 4);
}

export async function readFileAsAttachment(file: File, id?: string): Promise<Attachment> {
  const base: Omit<Attachment, "content" | "isBase64" | "status"> = {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
  const kind = classifyFile(file);
  const failed = (error: string, isBase64 = false): Attachment => ({ ...base, content: "", isBase64, status: "error", error });

  const invalid = validateFile(file);
  if (invalid) return failed(invalid, kind === "image");

  try {
    if (kind === "document") {
      // PDF/DOCX/XLSX: extracted server-side (pdfplumber/python-docx/openpyxl)
      // so the assistant sees the document's text, not an inert blob.
      const result = await extractViaServer(file);
      if (!result.text) return failed(result.warning || "No readable text found");
      return { ...base, content: result.text, isBase64: false, status: "ready", warning: documentWarning(result) };
    }
    if (kind === "text") {
      const text = await readAsText(file);
      const truncated = text.length > MAX_INLINE_TEXT_CHARS;
      return {
        ...base,
        content: truncated ? text.slice(0, MAX_INLINE_TEXT_CHARS) : text,
        isBase64: false,
        status: "ready",
        warning: truncated ? "Long file: only the beginning was attached" : undefined,
      };
    }
    // Images go to the model as vision input.
    const dataUrl = await prepareImage(file);
    if (dataUrlBytes(dataUrl) > MAX_IMAGE_SEND_BYTES) return failed("Image too large after compression (max 8 MB)", true);
    return { ...base, content: dataUrl, isBase64: true, status: "ready", preview: dataUrl };
  } catch (e) {
    return failed(e instanceof Error ? e.message : "Could not read file", kind === "image");
  }
}
