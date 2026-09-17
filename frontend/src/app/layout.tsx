import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RootShell } from "@/components/layout/RootShell";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vatsa AI — Intelligence, orchestrated",
    template: "%s | Vatsa AI",
  },
  description:
    "Your intelligent AI workspace for coding, research, writing, and business.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
