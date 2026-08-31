"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

type Page<T> = { items: T[]; hasMore: boolean };

/** Every paginated row carries an id; that is what dedupes appended pages. */
const keyOf = (item: unknown) => (item as { id?: string }).id;

/**
 * Offset pagination driven by an IntersectionObserver sentinel: when the
 * sentinel scrolls into view, the next page is fetched and appended.
 */
export function useInfiniteList<T>(
  fetchPage: (offset: number) => Promise<Page<T>>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Guards a second fetch while one is in flight — the observer can fire again
  // before React has committed `loading`.
  const busy = useRef(false);
  const offset = useRef(0);
  const observer = useRef<IntersectionObserver | null>(null);

  // `hasMore` is read through a ref so the observer callback never goes stale
  // and `loadMore` keeps a stable identity.
  const more = useRef(true);
  useEffect(() => {
    more.current = hasMore;
  }, [hasMore]);

  const loadMore = useCallback(async () => {
    if (busy.current || !more.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await fetchPage(offset.current);
      offset.current += page.items.length;
      // Offset paging over a "newest first" list can repeat a row if something
      // is saved while the user is scrolling, so appends are deduplicated.
      setItems((current) => {
        const seen = new Set(current.map(keyOf));
        return [...current, ...page.items.filter((i) => !seen.has(keyOf(i)))];
      });
      setHasMore(page.hasMore);
      more.current = page.hasMore;
    } catch {
      // api() showed the error; stop paging rather than retrying in a loop.
      setHasMore(false);
      more.current = false;
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [fetchPage]);

  const reload = useCallback(async () => {
    busy.current = true;
    offset.current = 0;
    more.current = true;
    setItems([]);
    setHasMore(true);
    try {
      const page = await fetchPage(0);
      offset.current = page.items.length;
      setItems(page.items);
      setHasMore(page.hasMore);
      more.current = page.hasMore;
    } catch {
      setHasMore(false);
      more.current = false;
    } finally {
      setReady(true);
      busy.current = false;
    }
  }, [fetchPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  /**
   * A callback ref, not a plain one: the sentinel does not exist during the
   * initial loading render, and an effect keyed on a ref object would never
   * re-run once the node finally appears.
   */
  const sentinel = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) void loadMore();
        },
        // Start fetching a little before the sentinel is actually on screen.
        { rootMargin: "200px" },
      );
      observer.current.observe(node);
    },
    [loadMore],
  );

  useEffect(() => () => observer.current?.disconnect(), []);

  return { items, hasMore, loading, ready, sentinel, reload, setItems };
}

/** Convenience wrapper for endpoints shaped like `{ <key>: [...], hasMore }`. */
export function pageFetcher<T>(url: string, key: string, limit: number) {
  return async (offset: number): Promise<Page<T>> => {
    const data = await api<Record<string, unknown>>(
      `${url}?offset=${offset}&limit=${limit}`,
    );
    return {
      items: (data[key] as T[]) ?? [],
      hasMore: Boolean(data.hasMore),
    };
  };
}
