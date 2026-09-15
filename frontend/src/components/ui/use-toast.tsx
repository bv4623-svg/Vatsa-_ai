"use client";

import { useAppStore } from "@/stores/app-store";
import type { Toast } from "@/types";

type ToastInput = Omit<Toast, "id">;
type ToastStoreInput = Toast;

export function useToast() {
  const addToast = useAppStore((s) => s.addToast);

  const toast = (props: ToastInput) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const payload: ToastStoreInput = {
      id,
      type: props.type,
      message: props.message,
      duration: props.duration,
    };
    addToast(payload);
  };

  return { toast };
}