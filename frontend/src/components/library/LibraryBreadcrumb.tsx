"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";

export interface FolderCrumb {
  id: string;
  name: string;
}

interface LibraryBreadcrumbProps {
  path: FolderCrumb[];
  onNavigate: (index: number) => void;
}

/** index === -1 means "Library root". */
export function LibraryBreadcrumb({ path, onNavigate }: LibraryBreadcrumbProps) {
  const t = useTranslations("library.breadcrumb");
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <button onClick={() => onNavigate(-1)} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent/10 hover:text-foreground">
        <Home className="h-3.5 w-3.5" aria-hidden="true" /> {t("root")}
      </button>
      {path.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <button onClick={() => onNavigate(i)} className="rounded-md px-1.5 py-0.5 hover:bg-accent/10 hover:text-foreground">
            {crumb.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
