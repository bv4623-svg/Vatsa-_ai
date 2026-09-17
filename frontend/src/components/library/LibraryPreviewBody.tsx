import Image from "next/image";
import type { ItemPreview } from "@/lib/library-client";

export function LibraryPreviewBody({ preview }: { preview: ItemPreview }) {
  if (preview.kind === "messages") {
    return (
      <div className="space-y-3">
        {preview.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {preview.messages.map((m, i) => (
          <div key={i} className="rounded-lg border border-border/60 p-2.5 text-xs">
            <p className="mb-1 font-medium capitalize text-muted-foreground">{m.role}</p>
            <p className="whitespace-pre-wrap text-foreground/90">{m.content}</p>
          </div>
        ))}
      </div>
    );
  }

  if (preview.kind === "image") {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        {/* unoptimized: the URL points at the backend's own storage host
         * (BACKEND_PUBLIC_URL, which varies by deployment) with a
         * short-lived media token in the query string -- Next's image
         * optimizer would need that host allow-listed in next.config,
         * and would strip the token by re-fetching through its own proxy. */}
        <Image src={preview.url} alt="Generated preview" fill unoptimized className="object-contain" />
      </div>
    );
  }

  if (preview.kind === "file") {
    return preview.text ? (
      <pre className="whitespace-pre-wrap break-words text-xs text-foreground/90">{preview.text}</pre>
    ) : (
      <p className="text-sm text-muted-foreground">This file type has no text preview. Download it to view the contents.</p>
    );
  }

  return <p className="text-sm text-muted-foreground">No preview available for this item.</p>;
}
