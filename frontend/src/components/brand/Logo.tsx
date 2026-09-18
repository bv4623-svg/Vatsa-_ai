"use client";

import Link from "next/link";
import { AIIcon, type AIIconVariant } from "@/components/brand/AIIcon";
import { cn } from "@/lib/utils";

/** The mark + "Vatsa AI" wordmark, linked to home. Replaces every ad-hoc
 * `<Image src="/logo.png">` + text pairing that used to be copy-pasted
 * per surface (sidebars, auth shell, landing header/footer, legal pages)
 * with independently-drifting markup. */
export function Logo({
  compact = false,
  size = 28,
  variant = "gradient",
  wordmarkClassName,
  className,
}: {
  compact?: boolean;
  size?: number;
  variant?: AIIconVariant;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("focus-ring inline-flex items-center gap-2 rounded-lg", className)}
      aria-label="Vatsa AI home"
    >
      <AIIcon size={size} variant={variant} />
      {!compact && (
        <span className={cn("text-[17px] font-semibold tracking-[-.04em] text-foreground", wordmarkClassName)}>
          Vatsa <span className="text-muted-foreground">AI</span>
        </span>
      )}
    </Link>
  );
}
