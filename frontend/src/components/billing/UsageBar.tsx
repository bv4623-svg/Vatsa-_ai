"use client";

import { useRouter } from "next/navigation";

interface UsageBarProps {
  usage?: Record<string, { used: number; limit: number }>;
}

/** Compact "12/25 messages · 3 images left · 2 searches left" strip
 * shown to free users only, right below the header. */
export function UsageBar({ usage }: UsageBarProps) {
  const router = useRouter();
  if (!usage) return null;

  const chat = usage.chat_messages;
  const image = usage.image_gen;
  const search = usage.web_search;
  if (!chat) return null;

  const chatLeft = Math.max(0, chat.limit - chat.used);
  const parts: string[] = [`${chat.used} / ${chat.limit} messages used today`];
  if (image) parts.push(`${Math.max(0, image.limit - image.used)} images left`);
  if (search) parts.push(`${Math.max(0, search.limit - search.used)} searches left`);

  const isLow = chatLeft <= Math.ceil(chat.limit * 0.2);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-background/30 px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className={isLow ? "text-amber-500" : ""}>{parts.join(" · ")}</span>
      <button
        onClick={() => router.push("/pricing")}
        className="flex-shrink-0 font-medium text-accent hover:underline"
      >
        Upgrade →
      </button>
    </div>
  );
}
