"use client";

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";

export const RenameModal = memo(({ open, onClose, onRename, currentTitle }: { open: boolean; onClose: () => void; onRename: (title: string) => void; currentTitle?: string }) => {
  const [value, setValue] = useState(currentTitle || "");
  useEffect(() => {
    setValue(currentTitle || "");
  }, [currentTitle, open]);

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
        <h3 className="text-lg font-semibold text-foreground">Rename conversation</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(value); onClose(); } }}
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent/10 text-sm">Cancel</button>
          <button onClick={() => { onRename(value); onClose(); }} className="flex-1 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm">Rename</button>
        </div>
      </motion.div>
    </div>
  );
});
RenameModal.displayName = "RenameModal";
