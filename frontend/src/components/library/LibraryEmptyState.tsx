import { FolderOpen } from "lucide-react";

export function LibraryEmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
      <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground/80">
        {search ? "No items match your search" : "Nothing here yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {search
          ? "Try a different search term or clear the filter."
          : "Chats, code projects, uploads and generated images you create show up here automatically."}
      </p>
    </div>
  );
}
