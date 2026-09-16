import type { Attachment } from "@/types/home";

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  const isTextLike =
    file.type.startsWith("text/") ||
    /(json|xml|javascript|typescript|csv|yaml|yml|markdown)$/i.test(file.type) ||
    /\.(txt|md|markdown|json|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|html|htm|css|scss|sass|xml|yaml|yml|csv|tsv|log|sh|bash|zsh|sql|kt|swift|dart|r|m|pl|lua|vue|svelte)$/i.test(file.name);

  return new Promise<Attachment>((resolve) => {
    const reader = new FileReader();
    const base: Omit<Attachment, "content" | "isBase64" | "status"> = {
      id, name: file.name, type: file.type || "application/octet-stream", size: file.size,
    };
    if (isTextLike && !isImage && !isPdf) {
      reader.onload = () => resolve({ ...base, content: String(reader.result || ""), isBase64: false, status: "ready" });
      reader.onerror = () => resolve({ ...base, content: "", isBase64: false, status: "error" });
      reader.readAsText(file);
      return;
    }
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({ ...base, content: dataUrl, isBase64: true, status: "ready", preview: isImage ? dataUrl : undefined });
    };
    reader.onerror = () => resolve({ ...base, content: "", isBase64: true, status: "error" });
    reader.readAsDataURL(file);
  });
}
