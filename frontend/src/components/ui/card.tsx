"use client";

import { cn } from "@/lib/utils";

type CardVariant = "default" | "outlined" | "elevated";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: "bg-white dark:bg-zinc-900 border border-border-subtle dark:border-border-dark",
  outlined: "border-2 border-border-subtle dark:border-border-dark",
  elevated: "bg-white dark:bg-zinc-900 shadow-lg border border-border-subtle/50 dark:border-border-dark/50",
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({ variant = "default", padding = "md", className, children, onClick, hoverable }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-150",
        variantStyles[variant],
        paddingStyles[padding],
        hoverable && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mb-3", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-lg font-semibold text-zinc-900 dark:text-zinc-100", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-sm text-zinc-500 dark:text-zinc-400", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(className)}>{children}</div>;
}
