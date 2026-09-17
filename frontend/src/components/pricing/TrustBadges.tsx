"use client";

import { Shield } from "lucide-react";
import { TRUST_BADGES } from "@/data/plans";

export function TrustBadges() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-gray-500 dark:text-gray-400">
      {TRUST_BADGES.map((badge) => (
        <li key={badge} className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-500" aria-hidden="true" />
          <span className="text-sm">{badge}</span>
        </li>
      ))}
    </ul>
  );
}
