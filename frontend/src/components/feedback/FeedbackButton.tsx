"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

import { FeedbackModal } from "@/components/feedback/FeedbackModal";

const HIDDEN_ON = ["/login", "/signup", "/auth", "/forgot-password", "/reset-password", "/logout"];

export function FeedbackButton() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
        // Raised on small screens so it never covers the chat composer's send button.
        className="fixed bottom-28 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/90 text-zinc-500 shadow-lg backdrop-blur-sm transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:bottom-6 md:right-6"
      >
        <MessageSquarePlus className="h-5 w-5" aria-hidden />
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
