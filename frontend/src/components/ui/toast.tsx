"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const ICONS = { success: Check, error: AlertCircle, warning: AlertTriangle, info: Info } as const;

/** Renders the app store's toasts (useToast / addToast); the store removes each after its duration. */
export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[150] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] ?? Info;
          return (
            <motion.div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              onClick={() => removeToast(t.id)}
              className={cn(
                "pointer-events-auto flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-sm",
                t.type === "success" && "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-300",
                t.type === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
                t.type === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
                t.type === "info" && "border-border/60 bg-card/90 text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
