"use client";

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader } from "lucide-react";

export const ImageLoadingGrid = memo(() => {
  const phrases = [
    "Twinning pixels…",
    "Sketching shapes…",
    "Blending colors…",
    "Almost there…",
    "Adding final touches…",
    "Polishing details…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-2xl bg-accent/[0.06] p-3 w-full max-w-[320px]">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.1 }}
              animate={{ opacity: [0.1, 0.55, 0.1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (i % 4) * 0.12 + Math.floor(i / 4) * 0.08,
              }}
              className="aspect-square rounded-md bg-gradient-to-br from-accent/50 to-accent/10"
            />
          ))}
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18, ease: "easeInOut" }}
              className="block w-1.5 h-1.5 rounded-full bg-accent"
            />
          ))}
        </div>
      </div>

      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-muted-foreground/70 flex items-center gap-2"
      >
        <Loader className="w-3 h-3 animate-spin" />
        {phrases[idx]}
      </motion.p>
    </div>
  );
});
ImageLoadingGrid.displayName = "ImageLoadingGrid";
