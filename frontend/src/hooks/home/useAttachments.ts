import { useState, useCallback, useRef } from "react";
import type { Attachment } from "@/types/home";
import { readFileAsAttachment } from "@/lib/home/attachments";

/** File/folder attachment state for the Chat composer. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setShowAttachmentMenu(false);
    const fileArr = Array.from(files);

    const placeholders: Attachment[] = fileArr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, type: f.type || "application/octet-stream", size: f.size,
      content: "", isBase64: false, status: "processing",
    }));
    setAttachments((prev) => [...prev, ...placeholders]);

    try {
      const results = await Promise.all(fileArr.map(readFileAsAttachment));
      setAttachments((prev) => {
        const cleaned = prev.filter(
          (p) => !(p.status === "processing" && results.some((r) => r.name === p.name))
        );
        return [...cleaned, ...results];
      });
    } catch {
      setAttachments((prev) => prev.map(p => p.status === "processing" ? { ...p, status: "error" } : p));
    } finally {
      e.target.value = "";
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    attachments, setAttachments,
    showAttachmentMenu, setShowAttachmentMenu,
    fileInputRef, folderInputRef,
    handleFileUpload, removeAttachment,
  };
}
