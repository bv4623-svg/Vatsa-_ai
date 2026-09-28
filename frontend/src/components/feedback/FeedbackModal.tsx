"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_TYPES,
  MESSAGE_MAX,
  feedbackMessageError,
  submitFeedback,
  type FeedbackType,
} from "@/services/feedback";

const FIELD = "w-full rounded-lg border border-border-input bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary-500 dark:border-border-dark";
const LABEL = "mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function describeSubmitError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/failed to fetch|network/i.test(message)) return "Can't reach the server. Check your connection and try again.";
  return message || "Couldn't send your feedback. Please try again.";
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const signedIn = Boolean(user) || Boolean(getToken());

  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messageError = feedbackMessageError(message);
  const length = message.trim().length;

  const reset = () => {
    setType("bug");
    setMessage("");
    setRating(null);
    setEmail("");
    setTouched(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (messageError || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback({ type, message, rating, email: signedIn ? undefined : email, pageUrl: window.location.href });
      toast({ type: "success", message: "Thanks! Your feedback was sent." });
      reset();
      onClose();
    } catch (err) {
      setError(describeSubmitError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send feedback">
      <form onSubmit={handleSubmit} noValidate aria-label="Feedback form" className="space-y-4">
        <div>
          <label htmlFor="feedback-type" className={LABEL}>Type</label>
          <select id="feedback-type" value={type} onChange={(e) => setType(e.target.value as FeedbackType)} className={cn(FIELD, "bg-white dark:bg-zinc-900")}>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="feedback-message" className={LABEL}>Message</label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={5}
            maxLength={MESSAGE_MAX + 200}
            placeholder="What happened, or what would make Vatsa AI better?"
            aria-invalid={touched && Boolean(messageError)}
            aria-describedby="feedback-message-hint"
          />
          <div id="feedback-message-hint" className="mt-1 flex justify-between text-xs text-zinc-500">
            <span className={cn(touched && messageError && "text-destructive")}>{touched && messageError ? messageError : " "}</span>
            <span className={cn(length > MESSAGE_MAX && "text-destructive")}>{length} / {MESSAGE_MAX}</span>
          </div>
        </div>

        <fieldset>
          <legend className={LABEL}>Rating (optional)</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={rating !== null && n <= rating}
                onClick={() => setRating(rating === n ? null : n)}
                className="rounded p-0.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Star className={cn("h-5 w-5", rating !== null && n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-400")} />
              </button>
            ))}
          </div>
        </fieldset>

        {!signedIn && (
          <div>
            <label htmlFor="feedback-email" className={LABEL}>Email (optional, if you want a reply)</label>
            <input id="feedback-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={FIELD} />
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={sending} disabled={sending}>Send feedback</Button>
        </div>
      </form>
    </Modal>
  );
}
