"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Load JSON on mount, with a `reload` for refresh buttons and post-save
 * refetches. `null` means "still loading" — callers render a skeleton.
 *
 * The set-state-in-effect rule is disabled deliberately: the state update
 * happens after an await, not synchronously in the effect body, which is the
 * cascading-render case the rule exists to catch.
 */
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);

  const reload = useCallback(async () => {
    setData(await api<T>(url));
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload().catch(() => {
      // api() already showed the toast; `data` stays null and we keep the skeleton.
    });
  }, [reload]);

  return { data, setData, reload };
}
