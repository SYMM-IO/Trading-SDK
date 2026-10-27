"use client";

import type { PoolReadGap } from "@symmio/trading-core";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";

/** Internal sequential pagination over the existing primitive query keys. */
export function usePoolPages<Page, T>(input: {
  options: (offset: number) => { queryKey: readonly unknown[]; queryFn: () => Promise<Page> };
  selectPage: (page: Page, offset: number) => { items: readonly T[]; total: number };
  refetchInterval?: number | false;
  identity: (item: T) => string;
  source: string;
  pageSize: number;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  // Subscribe to the source cache itself: a wallet/key change can finish a page
  // between render and observer subscription. The snapshot closes that race.
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  function pageOffsets() {
    const seen = new Set<string>();
    const offsets: number[] = [];
    let offset = 0;
    for (let index = 0; index < 10; index++) {
      offsets.push(offset);
      const options = input.options(offset);
      if (!input.enabled) break;
      const cached = queryClient.getQueryState<Page>(options.queryKey);
      if (cached?.status !== "success" || cached.data == null) break;
      const page = input.selectPage(cached.data, offset);
      const before = seen.size;
      for (const item of page.items) seen.add(input.identity(item));
      if (seen.size >= page.total || seen.size === before) break;
      offset += page.items.length;
    }
    // A primitive snapshot stays referentially stable until the plan changes.
    return offsets.join(",");
  }
  const offsets = useSyncExternalStore(subscribe, pageOffsets, pageOffsets).split(",").map(Number);
  const count = offsets.length;
  const planned = offsets.map(input.options);
  const queries = useQueries({
    queries: planned.map((options) => {
      return {
        queryKey: options.queryKey,
        queryFn: async () => {
          try {
            return await options.queryFn();
          } catch (error) {
            throw normalizeSymmError(error);
          }
        },
        enabled: input.enabled,
        refetchInterval: input.refetchInterval,
      };
    }),
  });
  const items = new Map<string, T>();
  let repeated = false;
  for (const [index, query] of queries.entries()) {
    if (!query.data) continue;
    const page = input.selectPage(query.data, offsets[index]!);
    const before = items.size;
    for (const item of page.items) items.set(input.identity(item), item);
    if (items.size === before && items.size < page.total) repeated = true;
  }
  const last = queries.at(-1)?.data;
  const total = last == null ? 0 : input.selectPage(last, offsets[count - 1]!).total;
  const error = queries.find((query) => query.error)?.error ?? null;
  const settled = queries.every((query) => query.isSuccess);
  const more = settled && !repeated && items.size < total && count < 10;
  const gaps: PoolReadGap[] = error
    ? [{ source: input.source, reason: "failed" }]
    : repeated
      ? [{ source: input.source, reason: "repeated-page" }]
      : settled && !more && items.size < total
        ? [{ source: input.source, reason: "truncated" }]
        : [];
  return {
    items: [...items.values()],
    gaps,
    error,
    isLoading: input.enabled && (more || queries.some((query) => query.isPending)),
    isFetching: queries.some((query) => query.isFetching),
    refetch: () => Promise.all(input.enabled ? queries.map((query) => query.refetch()) : []),
  };
}
