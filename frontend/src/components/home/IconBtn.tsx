"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/home/Tooltip";

export const IconBtn = memo(({ children, tip, label, side = "bottom", onClick, className, disabled, active }: any) => (
  <Tooltip text={tip} side={side}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // The tooltip is visual only; screen readers need the name on the button.
      aria-label={label ?? (typeof tip === "string" ? tip : undefined)}
      className={cn(
        "focus-ring relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-accent/10 text-foreground",
        className
      )}
    >
      {children}
    </button>
  </Tooltip>
));
IconBtn.displayName = "IconBtn";
