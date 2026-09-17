"use client";

import { useTranslations } from "next-intl";
import { Download, Trash2, X } from "lucide-react";

interface LibraryBulkBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

export function LibraryBulkBar({ count, onClear, onDelete, onDownload }: LibraryBulkBarProps) {
  const t = useTranslations("library.bulkBar");
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm">
      <span className="font-medium text-foreground">{t("selected", { count })}</span>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onDownload} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10">
          <Download className="h-3.5 w-3.5" /> {t("download")}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10">
          <Trash2 className="h-3.5 w-3.5" /> {t("delete")}
        </button>
        <button onClick={onClear} aria-label={t("clearSelection")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
