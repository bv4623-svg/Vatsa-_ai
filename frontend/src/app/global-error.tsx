"use client";

import "./globals.css";

/** Last-resort boundary for errors in the root layout itself; it replaces the whole document. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <title>Something went wrong | Vatsa AI</title>
        <main role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-zinc-500">Vatsa AI hit an unexpected error. Please try again.</p>
          <button type="button" onClick={() => retry()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Try again
          </button>
          {error.digest && <p className="text-xs text-zinc-500">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
