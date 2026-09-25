import type { Attachment } from "@/types/home";
import { API_BASE } from "@/lib/home/constants";

interface UploadResponse {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
  url: string | null;
  thumbnail_url: string | null;
  text: string;
}

interface UploadHandle {
  promise: Promise<UploadResponse>;
  abort: () => void;
}

/** Real XHR upload (not a simulated timer) -- every file type goes through
 * this, through POST /api/upload, so it's persisted (Library row, counts
 * toward storage quota, survives a refresh) regardless of type, with real
 * progress from xhr.upload.onprogress and a real abort() for cancel. */
export function uploadFile(file: File, onProgress?: (percent: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResponse>((resolve, reject) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const form = new FormData();
    form.append("file", file);

    xhr.open("POST", `${API_BASE}/api/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid response from server"));
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        const detail = body?.detail;
        message = typeof detail === "string" ? detail : detail?.message || message;
      } catch {
        /* non-JSON error body, keep the generic message */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

/** True for extensions the backend will actually accept (see
 * Backend/app/routers/upload.py's IMAGE/TEXT/DOCUMENT_EXTENSIONS) --
 * checked client-side too so a doomed upload never even starts. */
const ALLOWED_RE =
  /\.(png|jpe?g|gif|webp|svg|txt|md|markdown|csv|json|log|py|jsx?|tsx?|html?|css|scss|sass|xml|ya?ml|sh|bash|zsh|sql|java|c|cpp|h|hpp|cs|go|rs|rb|php|kt|swift|dart|r|m|pl|lua|vue|svelte|tsv|pdf|docx|xlsx|xlsm)$/i;

export async function readFileAsAttachment(
  file: File,
  id: string,
  onProgress?: (id: string, percent: number) => void,
  registerAbort?: (id: string, abort: () => void) => void
): Promise<Attachment> {
  const isImage = file.type.startsWith("image/") || /\.(svg)$/i.test(file.name);
  const base: Omit<Attachment, "content" | "isBase64" | "status"> = {
    id, name: file.name, type: file.type || "application/octet-stream", size: file.size,
  };

  if (!ALLOWED_RE.test(file.name)) {
    return { ...base, content: "", isBase64: false, status: "error", errorMessage: "File type not supported" };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { ...base, content: "", isBase64: false, status: "error", errorMessage: "File exceeds 25 MB limit" };
  }

  const { promise, abort } = uploadFile(file, (pct) => onProgress?.(id, pct));
  registerAbort?.(id, abort);

  let uploaded: UploadResponse;
  try {
    uploaded = await promise;
  } catch (e) {
    return {
      ...base, content: "", isBase64: false, status: "error",
      errorMessage: e instanceof Error ? e.message : "Upload failed",
    };
  }

  const persisted = {
    fileId: uploaded.id,
    url: uploaded.url ?? undefined,
    thumbnailUrl: uploaded.thumbnail_url ?? undefined,
  };

  if (isImage) {
    // The vision model needs an actual base64 data URL, which the upload
    // response doesn't include (no reason to round-trip the same bytes
    // back down after just uploading them) -- read it locally in
    // parallel with the upload that already persisted the real file.
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
    return {
      ...base, ...persisted,
      content: dataUrl, isBase64: true, status: dataUrl ? "ready" : "error",
      preview: dataUrl || undefined,
    };
  }

  return { ...base, ...persisted, content: uploaded.text || "", isBase64: false, status: "ready" };
}
