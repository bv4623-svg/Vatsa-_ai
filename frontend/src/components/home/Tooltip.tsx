"use client";

import { memo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Tooltip = memo(({ children, text, side = "bottom" }: { children: ReactNode; text: string; side?: "top" | "bottom" | "left" | "right" }) => {
  const [show, setShow] = useState(false);
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn("absolute z-50 px-2 py-1 text-xs font-medium text-white bg-black rounded shadow-lg whitespace-nowrap pointer-events-none", positionClasses[side])}
        >
          {text}
        </motion.div>
      )}
    </div>
  );
});
Tooltip.displayName = "Tooltip";
