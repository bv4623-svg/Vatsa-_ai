"use client";

import { memo, type ReactNode } from "react";

export const ToolbarPopover = memo(({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => {
  if (!open) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border bg-background p-3 shadow-2xl z-50" onMouseLeave={onClose}>
      <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
});
ToolbarPopover.displayName = "ToolbarPopover";
