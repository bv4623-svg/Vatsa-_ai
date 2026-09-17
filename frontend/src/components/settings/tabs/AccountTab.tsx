"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, AlertTriangle } from "lucide-react";
import { downloadAccountExport, deleteAccount } from "@/lib/account-client";
import { clearSession } from "@/lib/session";

export function AccountTab() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await downloadAccountExport();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      clearSession();
      router.replace("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Incorrect password.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-foreground">Export your data</label>
        <p className="mt-0.5 text-xs text-muted-foreground">A zip of your profile, conversations, memories, library items, projects and uploaded files.</p>
        {exportError && <p className="mt-1 text-xs text-red-500">{exportError}</p>}
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent/5 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Download data export"}
        </button>
      </div>

      <div className="rounded-lg border border-red-500/30 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <label className="text-sm font-medium text-red-500">Delete account</label>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your account is deactivated immediately and permanently deleted after a 30-day grace period.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mt-3 rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
            Delete my account
          </button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 flex flex-wrap items-center gap-2">
            {deleteError && <p className="w-full text-xs text-red-500">{deleteError}</p>}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-56 rounded-lg border border-border bg-input/10 px-3 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
            />
            <button type="submit" disabled={deleting || !password} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
