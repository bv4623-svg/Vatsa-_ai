"use client";

import { motion } from "framer-motion";

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d1a]">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.08)_0%,transparent_70%)]" />

      {/* Animated loading rings */}
      <div className="flex flex-col items-center gap-6 relative">
        <div className="relative h-20 w-20">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-blue-500/20"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          />
          {/* Middle ring */}
          <motion.div
            className="absolute inset-[6px] rounded-full border-2 border-blue-400/30"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
          />
          {/* Inner ring */}
          <motion.div
            className="absolute inset-[12px] rounded-full border-2 border-blue-300/40"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
          {/* Center glow */}
          <div className="absolute inset-[28px] rounded-full bg-blue-500/20 blur-sm" />
        </div>

        {/* Pulsing text */}
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="text-sm text-gray-400 font-medium tracking-wider"
        >
          Loading Vatsa AI...
        </motion.p>
      </div>
    </div>
  );
}