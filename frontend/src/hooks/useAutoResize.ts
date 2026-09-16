import { useLayoutEffect, type RefObject } from "react";

/** Grows a textarea to fit its content, up to maxHeight (px). */
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight = 200
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [value, ref, maxHeight]);
}
