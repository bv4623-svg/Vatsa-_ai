"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/config/api";
import { PRICES_INR } from "@/config/pricing";

export interface LiveInrPrices {
  pro: number;
  business: number;
}

interface ExchangeRateResponse {
  usd_to_inr: number;
  source: "live" | "fallback";
  prices_usd: { pro: number; business: number };
  prices_inr: LiveInrPrices;
}

/**
 * Fetches GET /api/pricing/exchange-rate once per mount and returns the INR
 * prices it produces for Pro/Business -- the same figures the backend
 * actually charges through Razorpay (Backend/app/services/exchange_rate.py
 * and payment_service.py), so the pricing page and checkout never show a
 * different INR number than what gets charged.
 *
 * `prices` starts as the static, fixed-rate fallback from
 * src/config/pricing.ts and stays there if the fetch fails -- callers
 * always get a usable number, never null/undefined, and only need
 * `loading` to decide whether to show a skeleton in place of it.
 */
export function useLiveInrPrices(): { prices: LiveInrPrices; loading: boolean } {
  const [prices, setPrices] = useState<LiveInrPrices>(PRICES_INR);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/pricing/exchange-rate`)
      .then((res) => (res.ok ? (res.json() as Promise<ExchangeRateResponse>) : Promise.reject(res.status)))
      .then((data) => {
        if (!cancelled && data?.prices_inr) setPrices(data.prices_inr);
      })
      .catch(() => {
        // Static fallback (already the initial state) stays in place.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { prices, loading };
}
