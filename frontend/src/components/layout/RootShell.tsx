"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsModal } from "@/components/settings/settings-modal";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/components/auth/SessionProvider";

function applyStoredTheme() {
  try {
    const stored = localStorage.getItem("vatsa-storage");
    let theme = "system";
    if (stored) {
      const parsed = JSON.parse(stored);
      theme = parsed.state?.settings?.theme || parsed.state?.theme || "system";
    }
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  } catch {
    // localStorage unavailable (private mode) -- keep the default theme.
  }
}

export function RootShell({ children }: { children: ReactNode }) {
  // usePathname instead of window.location: reading window during render
  // gave the transition a different key on the server than on the client.
  const pathname = usePathname();

  useEffect(() => {
    applyStoredTheme();
  }, []);

  return (
    <AuthProvider>
      <SessionProvider>
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
      </SessionProvider>
    </AuthProvider>
  );
}
