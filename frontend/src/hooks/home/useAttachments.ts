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

    const input = e.target;
    const placeholders: Attachment[] = fileArr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, type: f.type || "application/octet-stream", size: f.size,
      content: "", isBase64: false, status: "processing",
    }));
    setAttachments((prev) => [...prev, ...placeholders]);
    // Clear right away so picking the same file again re-triggers onChange.
    input.value = "";

    // Each file replaces its own placeholder (matched by id, not name) as
    // soon as it is ready; a placeholder the user removed stays removed.
    await Promise.all(
      fileArr.map(async (file, i) => {
        const id = placeholders[i].id;
        const result = await readFileAsAttachment(file, id).catch(
          (): Attachment => ({ ...placeholders[i], status: "error", error: "Could not read file" })
        );
        setAttachments((prev) => prev.map((a) => (a.id === id ? result : a)));
      })
    );
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
