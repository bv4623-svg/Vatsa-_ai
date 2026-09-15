"use client";
import React from "react";
import { useRouter } from "next/navigation";

type Props = {
  open?: boolean;
  onClose?: () => void;
  message?: string;
};

export function UpgradeModal({ open = true, onClose, message }: Props) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold">🚀 Upgrade Required</h3>
        <p className="mt-2 text-sm text-gray-600">
          {message || "Yeh feature premium/pro plan mein available hai."}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => router.push("/pricing")}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}
