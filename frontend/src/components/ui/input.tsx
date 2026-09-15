"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputVariant = "outline" | "filled" | "ghost";
type InputSize = "sm" | "md" | "lg";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  inputSize?: InputSize;
  error?: string;
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<InputVariant, string> = {
  outline: "border border-border-input bg-transparent focus:border-primary-500 dark:border-border-dark",
  filled: "border border-transparent bg-zinc-100 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 focus:border-primary-500",
  ghost: "border border-transparent bg-transparent focus:bg-zinc-50 dark:focus:bg-zinc-900",
};

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-4 py-2.5 text-sm rounded-lg",
  lg: "px-4 py-3 text-base rounded-lg",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "outline", inputSize = "md", error, label, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full transition-all duration-150",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
              "text-zinc-900 dark:text-zinc-100",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
              variantStyles[variant],
              sizeStyles[inputSize],
              leftIcon ? "pl-10" : "",
              rightIcon ? "pr-10" : "",
              error && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">{rightIcon}</div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps };
