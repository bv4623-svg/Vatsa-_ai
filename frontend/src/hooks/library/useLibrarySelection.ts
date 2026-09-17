"use client";

import { useCallback, useMemo, useState } from "react";

export function useLibrarySelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(visibleIds)), [visibleIds]);
  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selected.has(id)),
    [visibleIds, selected]
  );

  return { selected, toggle, selectAll, clear, allSelected, count: selected.size };
}
