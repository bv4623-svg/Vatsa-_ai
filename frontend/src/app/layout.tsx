"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./globals.css";
import { SettingsModal } from "@/components/settings/settings-modal";
import { useAppStore } from "@/stores/app-store";
import { AuthProvider } from "@/context/AuthContext";

// AppInitializer component – placed inside layout to fetch data on mount
function AppInitializer() {
  const { fetchAllData, isAuthenticated } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token && !isAuthenticated) {
      fetchAllData();
    }
  }, [fetchAllData, isAuthenticated]);

  return null; // no UI
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Theme logic – reads from localStorage and applies dark class
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vatsa-storage');
      let theme = 'system';
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.state?.settings?.theme) {
            theme = parsed.state.settings.theme;
          } else if (parsed.state?.theme) {
            theme = parsed.state.theme;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      let resolved = theme;
      if (theme === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Merriweather:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased font-sans">
        <AuthProvider>
          <AppInitializer />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={typeof window !== 'undefined' ? window.location.pathname : 'initial'}
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
        </AuthProvider>
      </body>
    </html>
  );
}