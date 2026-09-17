"use client";

import { ExternalLink } from "lucide-react";

const LEGAL_LINKS = [
  { label: "About Vatsa AI", href: "/about" }, { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" }, { label: "Security", href: "/security" },
  { label: "Disclaimer", href: "/disclaimer" }, { label: "Refund Policy", href: "/refund" },
  { label: "Return Policy", href: "/return" },
];

export function LegalTab() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-2">Legal & Information</p>
      <div className="grid grid-cols-1 gap-1">
        {LEGAL_LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/5 text-sm text-foreground/80 hover:text-foreground transition-colors">
            <span>{link.label}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground/50" />
          </a>
        ))}
      </div>
    </div>
  );
}
