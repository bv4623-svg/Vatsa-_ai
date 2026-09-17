"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Download, FileText } from "lucide-react";
import { getSharedItem } from "@/lib/library-client";
import { formatBytes } from "@/lib/format-bytes";
import { API_BASE } from "@/lib/session";
import type { LibraryItem } from "@/types/library";

/** Public page for a Library share link -- no login required, matching
 * the backend's deliberately unauthenticated GET /api/library/share/:token. */
export default function SharedItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [item, setItem] = useState<(LibraryItem & { previewUrl?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSharedItem(token)
      .then(setItem)
      .catch((err) => setError(err instanceof Error ? err.message : "This link is invalid or has expired."));
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {!error && !item && <div className="h-40 animate-pulse rounded-xl bg-white/5" />}

        {item && (
          <>
            <h1 className="truncate text-lg font-semibold text-white" title={item.name}>{item.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">{formatBytes(item.sizeBytes)} · Shared from Vatsa AI</p>

            {item.previewUrl ? (
              <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-xl bg-black/30">
                <Image src={item.previewUrl} alt={item.name} fill unoptimized className="object-contain" />
              </div>
            ) : (
              <div className="mt-4 flex h-40 items-center justify-center rounded-xl bg-black/30">
                <FileText className="h-10 w-10 text-zinc-600" />
              </div>
            )}

            {item.hasFile && (
              <a
                href={`${API_BASE}/api/library/share/${token}/file`}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}
