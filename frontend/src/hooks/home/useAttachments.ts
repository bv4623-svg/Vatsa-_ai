import { useState, useCallback, useRef } from "react";
import type { Attachment } from "@/types/home";
import { readFileAsAttachment } from "@/lib/home/attachments";

/** File/folder attachment state for the Chat composer. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortersRef = useRef<Map<string, () => void>>(new Map());

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setShowAttachmentMenu(false);
    const fileArr = Array.from(files);

    const placeholders: Attachment[] = fileArr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, type: f.type || "application/octet-stream", size: f.size,
      content: "", isBase64: false, status: "processing", progress: 0,
    }));
    setAttachments((prev) => [...prev, ...placeholders]);

    const onProgress = (id: string, percent: number) => {
      setAttachments((prev) => prev.map((p) => (p.id === id ? { ...p, progress: percent } : p)));
    };
    const registerAbort = (id: string, abort: () => void) => {
      abortersRef.current.set(id, abort);
    };

    try {
      const results = await Promise.all(
        fileArr.map((f, i) => readFileAsAttachment(f, placeholders[i].id, onProgress, registerAbort))
      );
      setAttachments((prev) => {
        const resultIds = new Set(results.map((r) => r.id));
        const cleaned = prev.filter((p) => !resultIds.has(p.id));
        return [...cleaned, ...results];
      });
    } finally {
      for (const p of placeholders) abortersRef.current.delete(p.id);
      e.target.value = "";
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    abortersRef.current.get(id)?.();
    abortersRef.current.delete(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    attachments, setAttachments,
    showAttachmentMenu, setShowAttachmentMenu,
    fileInputRef, folderInputRef,
    handleFileUpload, removeAttachment,
  };
}
