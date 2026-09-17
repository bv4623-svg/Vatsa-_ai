"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { shareItem, unshareItem } from "@/lib/library-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/library/asyncResource";
import type { LibraryItem } from "@/types/library";

interface LibraryShareModalProps {
  item: LibraryItem | null;
  onClose: () => void;
  onChanged: () => void;
}

export function LibraryShareModal({ item, onClose, onChanged }: LibraryShareModalProps) {
  return (
    <Modal open={!!item} onClose={onClose} size="sm" title={`Share "${item?.name ?? ""}"`}>
      <p className="text-sm text-muted-foreground">
        Anyone with this link can view this item. No account required.
      </p>
      {item && <ShareLinkPanel key={item.id} item={item} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

interface ShareLinkPanelProps {
  item: LibraryItem;
  onClose: () => void;
  onChanged: () => void;
}

/** Keyed by item.id above, so a fresh store/copy-state is built per item
 * instead of resetting them via an effect. */
function ShareLinkPanel({ item, onClose, onChanged }: ShareLinkPanelProps) {
  const store = useMemo(() => createAsyncQueryStore<string | null>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<string | null>);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (item.shared) {
      // Already shared: re-request to get the existing token back (the
      // endpoint returns the same token if one already exists).
      void store.run(() => shareItem(item.id).then((r) => `${window.location.origin}${r.url}`));
    } else {
      store.set(null);
    }
  }, [item, store]);

  const enable = () =>
    store.run(async () => {
      const r = await shareItem(item.id);
      onChanged();
      return `${window.location.origin}${r.url}`;
    });

  const revoke = () =>
    store.run(async () => {
      await unshareItem(item.id);
      onChanged();
      onClose();
      return null;
    });

  const copy = () => {
    if (!state.data) return;
    void navigator.clipboard.writeText(state.data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {state.data ? (
        <div className="mt-3 flex items-center gap-2">
          <input readOnly value={state.data} className="flex-1 truncate rounded-lg border border-border bg-input/10 px-3 py-2 text-xs text-foreground" />
          <button onClick={copy} aria-label="Copy share link" className="rounded-lg border border-border p-2 hover:bg-accent/10">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <button onClick={() => void enable()} disabled={state.loading} className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50">
          {state.loading ? "Creating link..." : "Create share link"}
        </button>
      )}

      {state.data && (
        <button onClick={() => void revoke()} disabled={state.loading} className="mt-3 text-sm text-red-500 hover:underline disabled:opacity-50">
          Revoke link
        </button>
      )}
    </>
  );
}
