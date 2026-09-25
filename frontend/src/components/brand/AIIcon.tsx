"use client";

import Image from "next/image";

export type AIIconVariant = "mono" | "gradient";

/** The Vatsa AI mark: the real brand logo (logo.png), used everywhere across
 * the app shell (sidebars, top bar, auth shell, workspace, code page,
 * billing, plus every marketing/legal page via components/layout/VatsaMark
 * and components/pricing/VatsaMark). `variant` is accepted for backward
 * compatibility with existing call sites but has no effect -- a raster
 * logo can't recolor to currentColor the way the old hand-drawn SVG mark
 * did, and nothing in the app actually passes variant="mono". */
export function AIIcon({
  size = 24,
  className,
}: {
  size?: number;
  variant?: AIIconVariant;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}
    >
      <Image src="/logo.png" alt="Vatsa AI" fill className="object-contain" sizes={`${size}px`} />
    </span>
  );
}
