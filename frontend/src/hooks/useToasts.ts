"use client";

import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback(
    (message: string, kind: Toast["kind"] = "info") => {
      const id = uid("toast");
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        2800
      );
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
