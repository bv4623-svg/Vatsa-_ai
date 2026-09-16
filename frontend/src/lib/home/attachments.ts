import type { Attachment } from "@/types/home";
import { API_BASE } from "@/lib/home/constants";

const SERVER_EXTRACTED_RE = /\.(pdf|docx|xlsx|xlsm)$/i;

async function extractViaServer(file: File): Promise<string> {
  const token = localStorage.getItem("access_token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to read ${file.name}`);
  }
  const data = await res.json();
  return data.text || "";
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const isImage = file.type.startsWith("image/");
  const needsServerExtraction = SERVER_EXTRACTED_RE.test(file.name);
  const isTextLike =
    !isImage &&
    !needsServerExtraction &&
    (file.type.startsWith("text/") ||
      /(json|xml|javascript|typescript|csv|yaml|yml|markdown)$/i.test(file.type) ||
      /\.(txt|md|markdown|json|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|html|htm|css|scss|sass|xml|yaml|yml|csv|tsv|log|sh|bash|zsh|sql|kt|swift|dart|r|m|pl|lua|vue|svelte)$/i.test(file.name));

  const base: Omit<Attachment, "content" | "isBase64" | "status"> = {
    id, name: file.name, type: file.type || "application/octet-stream", size: file.size,
  };

  // PDF/DOCX/XLSX: extract text server-side (pdfplumber/python-docx/openpyxl)
  // so the assistant actually sees the document's content, not an inert blob.
  if (needsServerExtraction) {
    try {
      const text = await extractViaServer(file);
      return { ...base, content: text, isBase64: false, status: "ready" };
    } catch {
      return { ...base, content: "", isBase64: false, status: "error" };
    }
  }

  return new Promise<Attachment>((resolve) => {
    const reader = new FileReader();
    if (isTextLike) {
      reader.onload = () => resolve({ ...base, content: String(reader.result || ""), isBase64: false, status: "ready" });
      reader.onerror = () => resolve({ ...base, content: "", isBase64: false, status: "error" });
      reader.readAsText(file);
      return;
    }
    // Images (and any other unrecognized binary type) go through as a data
    // URL -- for images the backend forwards this as vision input to the
    // AI model instead of trying to read it as text.
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({ ...base, content: dataUrl, isBase64: true, status: "ready", preview: isImage ? dataUrl : undefined });
    };
    reader.onerror = () => resolve({ ...base, content: "", isBase64: true, status: "error" });
    reader.readAsDataURL(file);
  });
}
