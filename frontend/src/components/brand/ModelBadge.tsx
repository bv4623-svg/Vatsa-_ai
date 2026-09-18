"use client";

import Image from "next/image";
import { modelLogos } from "@/components/pricing/ModelLogos";
import { AIIcon } from "@/components/brand/AIIcon";
import { cn } from "@/lib/utils";

/** Third-party providers get their own real brand mark (never a drawn
 * approximation of one) from the same asset set the pricing page's
 * "Powered by" strip uses. Anything not in that list -- including this
 * app's own vatsa-fast/vatsa-pro/vatsa-advanced models -- gets the Vatsa
 * mark itself rather than a fabricated logo. */
function findProviderLogo(model: string): { name: string; src: string } | undefined {
  const needle = model.toLowerCase();
  return modelLogos.find((logo) => needle.includes(logo.name.toLowerCase()));
}

export function ModelBadge({ model, size = 16, className }: { model: string; size?: number; className?: string }) {
  const provider = findProviderLogo(model);

  if (provider) {
    return (
      <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
        <Image src={provider.src} alt={provider.name} fill className="object-contain" sizes={`${size}px`} />
      </span>
    );
  }

  return <AIIcon size={size} variant="gradient" className={cn("shrink-0", className)} />;
}
