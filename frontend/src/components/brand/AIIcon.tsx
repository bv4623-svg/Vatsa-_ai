"use client";

import { useId } from "react";

export type AIIconVariant = "mono" | "gradient";

/** The Vatsa AI mark: three nodes -- two inputs converging on one output --
 * joined by two strokes that also read as a "V". Geometric and small
 * enough to hold up at 16px, distinct from a generic sparkle/star glyph
 * or robot clipart. `variant="mono"` paints with currentColor so it
 * follows surrounding text color; `variant="gradient"` uses the app's own
 * purple-to-pink accent (matching the Upgrade-to-Pro treatment elsewhere)
 * and ignores currentColor. */
export function AIIcon({
  size = 24,
  variant = "gradient",
  className,
}: {
  size?: number;
  variant?: AIIconVariant;
  className?: string;
}) {
  const gradientId = useId();
  const stroke = variant === "gradient" ? `url(#${gradientId})` : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Vatsa AI"
      className={className}
    >
      <title>Vatsa AI</title>
      {variant === "gradient" && (
        <defs>
          <linearGradient id={gradientId} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      )}
      <line x1="5.5" y1="5.5" x2="12" y2="18.5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18.5" y1="5.5" x2="12" y2="18.5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="5.5" cy="5.5" r="2.75" fill={stroke} />
      <circle cx="18.5" cy="5.5" r="2.75" fill={stroke} />
      <circle cx="12" cy="18.5" r="3.25" fill={stroke} />
    </svg>
  );
}
