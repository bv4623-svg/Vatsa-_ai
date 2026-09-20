"use client";

import { useSyncExternalStore } from "react";

/*
 * Server-rendered and statically exported HTML is produced at build time, on a
 * machine that has no idea what time it is for the visitor. Anything derived
 * from the clock must therefore render a stable fallback first and switch to
 * the real value after hydration. Calling `new Date()` directly during render
 * makes the hydrated text differ from the HTML, which React reports as error
 * #418 (for example "Good morning" in the HTML and "Good evening" on screen).
 *
 * getServerSnapshot (null) is also what React uses for the client's first,
 * hydrating render, so the two always agree; the clock value appears right
 * after. Same pattern as useCurrency / useTheme / AuthContext.
 */

function subscribeEveryMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

const beforeHydration = () => null;

/** The visitor's local hour (0-23), or null until the page has hydrated. */
export function useLocalHour(): number | null {
  return useSyncExternalStore(subscribeEveryMinute, () => new Date().getHours(), beforeHydration);
}

/** The visitor's local calendar year, or null until the page has hydrated. */
export function useLocalYear(): number | null {
  return useSyncExternalStore(subscribeEveryMinute, () => new Date().getFullYear(), beforeHydration);
}
