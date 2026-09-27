"use client";

import { API_BASE } from "@/lib/session";

const PROVIDERS = ["google", "github"] as const;

export function OAuthButtons() {
  const oauth = (provider: (typeof PROVIDERS)[number]) => {
    window.location.assign(`${API_BASE}/auth/${provider}/login`);
  };

  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">or continue with</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => oauth(p)}
            className="rounded-xl border border-white/10 py-2.5 text-xs font-medium capitalize text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {p}
          </button>
        ))}
      </div>
    </>
  );
}
