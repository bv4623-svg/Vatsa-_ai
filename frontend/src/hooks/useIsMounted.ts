import { useEffect, useRef } from "react";

/** Ref that stays true while the component is mounted; guards async state updates after unmount. */
export function useIsMounted() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
