"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS, reportReview, type ReportReason } from "@/services/reviews";

export function ReportModal({ reviewId, open, onClose, onReported }: { reviewId: number; open: boolean; onClose: () => void; onReported: () => void }) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await reportReview(reviewId, reason, details.trim() || undefined);
      onReported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report review" size="sm">
      <form onSubmit={submit} aria-label="Report form" className="space-y-3">
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">What is wrong with it?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Details (optional)
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
          />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={sending} disabled={sending}>Send report</Button>
        </div>
      </form>
    </Modal>
  );
}
