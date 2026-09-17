"use client";

import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import type { LibraryItem } from "@/types/library";

interface LibraryDeleteConfirmProps {
  item: LibraryItem | LibraryItem[] | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function LibraryDeleteConfirm({ item, onClose, onConfirm }: LibraryDeleteConfirmProps) {
  const t = useTranslations("library.deleteConfirm");
  const tCommon = useTranslations("common");
  const items = Array.isArray(item) ? item : item ? [item] : [];
  const isBulk = items.length > 1;
  const hasFolder = items.some((i) => i.isFolder);

  const confirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={items.length > 0} onClose={onClose} size="sm" title={isBulk ? t("titleMany", { count: items.length }) : t("titleOne", { name: items[0]?.name ?? "" })}>
      <p className="text-sm text-muted-foreground">
        {t("body")}
        {hasFolder && t("folderWarning")}
        {items.some((i) => i.type === "chat" || i.type === "code") && t("chatWarning")}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">{tCommon("cancel")}</button>
        <button onClick={confirm} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">{tCommon("delete")}</button>
      </div>
    </Modal>
  );
}
