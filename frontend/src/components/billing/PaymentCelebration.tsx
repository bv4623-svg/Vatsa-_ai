"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Crown, Star, Building2, PartyPopper } from "lucide-react";
import { getPlan, type PlanId } from "@/data/plans";

interface PaymentCelebrationProps {
  open: boolean;
  tier: Extract<PlanId, "pro" | "business" | "ultra">;
  onContinue: () => void;
}

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
}

const CONFETTI_COLORS = ["#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#3b82f6"];

/** Deterministic spread derived from the piece index. Math.random() during
 * render is impure, and scattering 60 pieces does not need real entropy --
 * the golden-ratio stride just avoids visible banding. */
function scatter(index: number, salt: number): number {
  const v = (index + 1) * 0.6180339887 * (salt + 1);
  return v - Math.floor(v);
}

const CONFETTI_PIECES: ConfettiPiece[] = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: scatter(i, 0) * 100,
  delay: scatter(i, 1) * 0.4,
  duration: 2.2 + scatter(i, 2) * 1.4,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotate: scatter(i, 3) * 360,
  size: 6 + scatter(i, 4) * 6,
}));

/** Shown right after a Razorpay payment verifies -- confetti burst + an
 * unlock card with the new tier badge. No page reload: the caller has
 * already patched the tier into the store before rendering this. */
export function PaymentCelebration({ open, tier, onContinue }: PaymentCelebrationProps) {
  const confetti = CONFETTI_PIECES;
  const planName = getPlan(tier)?.name ?? "Pro";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.map((c) => (
              <motion.span
                key={c.id}
                initial={{ top: "-5%", left: `${c.x}%`, opacity: 1, rotate: 0 }}
                animate={{ top: "110%", rotate: c.rotate }}
                transition={{ duration: c.duration, delay: c.delay, ease: "easeIn" }}
                className="absolute rounded-sm"
                style={{ width: c.size, height: c.size * 0.4, backgroundColor: c.color }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="relative mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-2xl"
          >
            <div
              className={
                "flex h-16 w-16 items-center justify-center rounded-full " +
                (tier === "ultra"
                  ? "bg-gradient-to-br from-amber-400/30 to-orange-500/30"
                  : tier === "business"
                  ? "bg-gradient-to-br from-cyan-500/30 to-blue-500/30"
                  : "bg-gradient-to-br from-purple-500/30 to-pink-500/30")
              }
            >
              {tier === "ultra" ? (
                <Crown className="h-8 w-8 text-amber-400" />
              ) : tier === "business" ? (
                <Building2 className="h-8 w-8 text-cyan-400" />
              ) : (
                <Star className="h-8 w-8 text-purple-400" />
              )}
            </div>
            <div>
              <h2 className="flex items-center justify-center gap-2 text-xl font-semibold text-foreground">
                <PartyPopper className="h-5 w-5 text-accent" />
                Welcome to {planName}!
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account is upgraded. Vision, reasoning, agents, and higher limits are unlocked now.
              </p>
            </div>
            <button
              onClick={onContinue}
              className="w-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Continue to Vatsa AI
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
