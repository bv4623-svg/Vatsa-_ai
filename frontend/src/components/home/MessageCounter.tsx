import { cn } from "@/lib/utils";
import { messageCounter } from "@/lib/chat-limits";

/** Character count above the composer, shown only near the message size limit. Parent must be `relative`. */
export function MessageCounter({ length }: { length: number }) {
  const counter = messageCounter(length);
  if (!counter.show) return null;
  return (
    <span
      role="status"
      aria-label={`${counter.text} characters`}
      className={cn("pointer-events-none absolute -top-5 right-3 text-[11px] tabular-nums", counter.over ? "text-destructive" : "text-muted-foreground")}
    >
      {counter.text}
    </span>
  );
}
