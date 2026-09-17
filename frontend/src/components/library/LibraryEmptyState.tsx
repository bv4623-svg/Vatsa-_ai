"use client";

import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";

export function LibraryEmptyState({ search }: { search: string }) {
  const t = useTranslations("library.emptyState");
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
      <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground/80">
        {search ? t("noResultsTitle") : t("emptyTitle")}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {search ? t("noResultsBody") : t("emptyBody")}
      </p>
    </div>
  );
}
