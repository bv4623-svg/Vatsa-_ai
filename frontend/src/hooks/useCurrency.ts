"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_CURRENCY, detectCurrency, type Currency } from "@/data/plans";

const STORAGE_KEY = "vatsa_currency";

// Resolved once per page load and cached, so getSnapshot returns a stable
// value (a fresh value each call would spin useSyncExternalStore forever).
let resolved: Currency | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Currency {
  if (resolved) return resolved;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "USD" || saved === "INR") {
      resolved = saved;
      return resolved;
    }
  } catch {
    // Storage blocked (private mode) -- fall back to region detection.
  }
  resolved = detectCurrency();
  return resolved;
}

// The server cannot know the visitor's region, so it always renders the
// default; the real currency appears on the client's first paint.
function getServerSnapshot(): Currency {
  return DEFAULT_CURRENCY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCurrency(next: Currency) {
  resolved = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Preference just won't persist across reloads.
  }
  listeners.forEach((l) => l());
}

/** Shared by /pricing and the in-app upgrade modal so both always show
 * the same currency for the same plan. */
export function useCurrency(): [Currency, (next: Currency) => void] {
  const currency = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [currency, setCurrency];
}
