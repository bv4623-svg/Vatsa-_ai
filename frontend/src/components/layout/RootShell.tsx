"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsModal } from "@/components/settings/settings-modal";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { UpgradeProvider } from "@/components/billing/UpgradeProvider";

export function RootShell({ children }: { children: ReactNode }) {
  // usePathname instead of window.location: reading window during render
  // gave the transition a different key on the server than on the client.
  const pathname = usePathname();

  return (
    <AuthProvider>
      <SessionProvider>
        <UpgradeProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="min-h-screen"
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <SettingsModal open={false} onClose={() => {}} />
        </UpgradeProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
