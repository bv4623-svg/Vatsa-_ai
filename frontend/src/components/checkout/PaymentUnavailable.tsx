import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Shown instead of a Pay button when the server can't take payments, so
 * checkout is disabled rather than opening a window that could never
 * complete. Only env var *names* are listed, never values. */
export function PaymentUnavailable({
  error,
  missing,
  amountLabel,
}: {
  error: string | null;
  missing?: string[];
  amountLabel: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-sm">
          <p className="font-semibold text-amber-300">Payment is not available right now</p>
          <p className="mt-1 text-amber-200/80">
            {error ?? "This server cannot take payments yet, so checkout is disabled."}
          </p>
          {missing?.length ? (
            <>
              <p className="mt-3 text-xs text-amber-200/70">Missing backend environment variables:</p>
              <ul className="mt-1 space-y-0.5">
                {missing.map((key) => (
                  <li key={key} className="font-mono text-xs text-amber-300">{key}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-400"
      >
        Pay {amountLabel} — unavailable
      </button>
      <Link href="/contact" className="mt-3 block text-center text-xs text-amber-300 hover:underline">
        Contact us to complete this purchase
      </Link>
    </div>
  );
}
