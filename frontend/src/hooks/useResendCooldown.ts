"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Disables a "resend code" action for `seconds` after it's used, with a
 * live countdown -- so a user can't spam the OTP-send endpoint by mashing
 * the button. This is a UI convenience on top of the real enforcement,
 * which is server-side (see Backend/app/routers/auth/otp.py's per-email
 * resend cooldown); it exists so the button reflects that limit instead
 * of just failing silently/confusingly on the 2nd+ click.
 */
export function useResendCooldown(seconds = 45) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds]);

  return { remaining, isCoolingDown: remaining > 0, start };
}
