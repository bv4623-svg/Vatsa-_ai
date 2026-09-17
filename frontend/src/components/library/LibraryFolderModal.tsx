"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

interface LibraryFolderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
}

export function LibraryFolderModal({ open, onClose, onCreate }: LibraryFolderModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      setName("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="New folder">
      <label htmlFor="library-folder-name" className="sr-only">Folder name</label>
      <input
        id="library-folder-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        placeholder="Folder name"
        className="w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button onClick={submit} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50">
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </Modal>
  );
}
