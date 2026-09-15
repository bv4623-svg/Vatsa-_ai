"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function IconBtn({
  children,
  onClick,
  tip,
  className,
  side = "bottom",
  disabled,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  tip?: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white disabled:opacity-50",
        active && "bg-zinc-800 text-white",
        className
      )}
      title={tip}
    >
      {children}
    </button>
  );
}

export function Tooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative group">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-0.5 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}