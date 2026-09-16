"use client";

import { memo } from "react";
import { motion } from "framer-motion";

export const DeleteConfirmModal = memo(({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-2xl border border-border p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">Delete conversation?</h3>
        <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent/10 text-sm">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
        </div>
      </motion.div>
    </div>
  );
});
DeleteConfirmModal.displayName = "DeleteConfirmModal";
