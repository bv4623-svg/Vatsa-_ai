"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import type { LibraryItem } from "@/types/library";

interface LibraryRenameModalProps {
  item: LibraryItem | null;
  onClose: () => void;
  onRename: (id: string, name: string) => Promise<void> | void;
}

export function LibraryRenameModal({ item, onClose, onRename }: LibraryRenameModalProps) {
  const t = useTranslations("library.renameModal");
  return (
    <Modal open={!!item} onClose={onClose} size="sm" title={t("title")}>
      {item && <RenameForm key={item.id} item={item} onClose={onClose} onRename={onRename} />}
    </Modal>
  );
}

interface RenameFormProps {
  item: LibraryItem;
  onClose: () => void;
  onRename: (id: string, name: string) => Promise<void> | void;
}

/** Keyed by item.id at the call site above, so switching items remounts
 * this form with a fresh initial name instead of syncing via an effect
 * (React's own guidance discourages useEffect for resetting state to a
 * changed prop -- a key-based remount is the recommended alternative). */
function RenameForm({ item, onClose, onRename }: RenameFormProps) {
  const t = useTranslations("library.renameModal");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onRename(item.id, trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <label htmlFor="library-rename-name" className="sr-only">{t("nameLabel")}</label>
      <input
        id="library-rename-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        className="w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">{tCommon("cancel")}</button>
        <button onClick={submit} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50">
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </>
  );
}
