"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StarInput } from "@/components/reviews/Stars";
import { cn } from "@/lib/utils";
import {
  BODY_MAX,
  REVIEW_TAGS,
  TAG_LABELS,
  createReview,
  reviewErrors,
  updateReview,
  type Review,
  type ReviewInput,
  type ReviewTag,
} from "@/services/reviews";

const FIELD = "w-full rounded-lg border border-border-input bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary-500 dark:border-border-dark";
const LABEL = "mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

const lines = (text: string) => text.split("\n");

interface ReviewFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (review: Review) => void;
  initial?: Review | null;
}

/** Create or edit a review. The form stays open when the server rejects the
 * review, showing the moderator note, so nothing typed is lost. */
export function ReviewForm({ open, onClose, onSaved, initial }: ReviewFormProps) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pros, setPros] = useState((initial?.pros ?? []).join("\n"));
  const [cons, setCons] = useState((initial?.cons ?? []).join("\n"));
  const [tags, setTags] = useState<ReviewTag[]>(initial?.tags ?? []);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input: ReviewInput = { rating, title, body, pros: lines(pros), cons: lines(cons), tags, is_public: isPublic };
  const errors = reviewErrors(input);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : undefined);

  const toggleTag = (tag: ReviewTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length || sending) return;
    setSending(true);
    setError(null);
    try {
      const saved = initial ? await updateReview(initial.id, input) : await createReview(input);
      if (saved.status === "rejected") {
        setError(saved.moderation_note ?? "Your review wasn't published.");
        onSaved(saved);
        return;
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(/failed to fetch|network/i.test(message) ? "Can't reach the server. Check your connection and try again." : message || "Couldn't save your review.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit your review" : "Write a review"} size="lg">
      <form onSubmit={submit} noValidate aria-label="Review form" className="space-y-4">
        <div>
          <span className={LABEL}>Your rating</span>
          <StarInput value={rating} onChange={setRating} />
          {show("rating") && <p className="mt-1 text-xs text-destructive">{errors.rating}</p>}
        </div>

        <div>
          <label htmlFor="review-title" className={LABEL}>Title (optional)</label>
          <input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={FIELD} placeholder="Sum it up in a few words" />
        </div>

        <div>
          <label htmlFor="review-body" className={LABEL}>Your review</label>
          <Textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={5}
            maxLength={BODY_MAX + 200}
            placeholder="What did you use Vatsa AI for, and how did it go?"
            aria-invalid={Boolean(show("body"))}
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-500">
            <span className={cn(show("body") && "text-destructive")}>{show("body") ?? " "}</span>
            <span>{body.trim().length} / {BODY_MAX}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="review-pros" className={LABEL}>Pros (one per line, optional)</label>
            <Textarea id="review-pros" value={pros} onChange={(e) => setPros(e.target.value)} rows={3} placeholder={"Fast answers\nGreat at code"} />
            {show("pros") && <p className="mt-1 text-xs text-destructive">{errors.pros}</p>}
          </div>
          <div>
            <label htmlFor="review-cons" className={LABEL}>Cons (one per line, optional)</label>
            <Textarea id="review-cons" value={cons} onChange={(e) => setCons(e.target.value)} rows={3} placeholder="Wish it had…" />
            {show("cons") && <p className="mt-1 text-xs text-destructive">{errors.cons}</p>}
          </div>
        </div>

        <fieldset>
          <legend className={LABEL}>Topics (optional, up to 5)</legend>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  tags.includes(tag) ? "border-primary-500 bg-primary-500/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-accent/10",
                )}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Show on the public reviews wall
        </label>

        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={sending} disabled={sending}>{initial ? "Save changes" : "Post review"}</Button>
        </div>
      </form>
    </Modal>
  );
}
