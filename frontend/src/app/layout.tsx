import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { RootShell } from "@/components/layout/RootShell";
import { LocaleProvider } from "@/providers/LocaleProvider";
import { localeDir } from "@/i18n/locales";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { SITE_URL } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vatsa AI — Intelligence, orchestrated",
    template: "%s | Vatsa AI",
  },
  description:
    "Your intelligent AI workspace for coding, research, writing, and business.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolved by i18n/request.ts: cookie -> Accept-Language -> "en". A
  // signed-in user's profile language then takes over client-side once
  // auth hydrates (see useSyncProfileLocale), and Settings' picker can
  // switch it instantly afterwards without a reload (LocaleProvider).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Merriweather:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased font-sans">
        <LocaleProvider initialLocale={locale} initialMessages={messages}>
          <RootShell>{children}</RootShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
