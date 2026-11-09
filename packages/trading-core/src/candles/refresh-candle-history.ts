import type { InfiniteData, QueryClient } from "@tanstack/query-core";
import { validateCandleHistoryRange, type CandleHistoryPage, type GetCandleHistoryQueryOptions } from "./history-query";
import type { CandleHistoryRange } from "./types";

/** Options for {@link refreshCandleHistory}; reuse the history query's original options. */
export interface RefreshCandleHistoryParameters {
  /** Options returned by getCandleHistoryQueryOptions, with any framework error wrapper. */
  queryOptions: GetCandleHistoryQueryOptions;
  /** Corrected candle starts. Omit to revalidate every retained window. */
  range?: CandleHistoryRange;
  /** Cancels a scheduled refresh; an existing shared query owns its transport cancellation. */
  signal?: AbortSignal;
}

/**
 * Revalidate retained candle history through its existing TanStack query.
 * A bounded correction waits for active paging, then reuses windows outside the
 * correction. A full refresh cancels an active request before revalidating all
 * windows. Query state exposes fetching and failures; no separate cache is used.
 *
 * @param queryClient - Client owning the original infinite history query.
 * @param parameters - Original query options, optional corrected range, and lifecycle signal.
 * @returns Resolves after the refresh; rejects on request failure or cancellation.
 * @example
 * ```ts
 * const queryOptions = getCandleHistoryQueryOptions(source, options);
 * await refreshCandleHistory(queryClient, { queryOptions, range: correction });
 * ```
 */
export async function refreshCandleHistory(
  queryClient: QueryClient,
  parameters: RefreshCandleHistoryParameters,
): Promise<void> {
  const { queryOptions, range, signal } = parameters;
  const { queryKey } = queryOptions;
  signal?.throwIfAborted();
  if (range) validateCandleHistoryRange(range);

  if (!range) {
    await queryClient.cancelQueries({ queryKey, exact: true });
  } else {
    /** Join active work instead of discarding an older page when a correction arrives. */
    let state = queryClient.getQueryState(queryKey);
    while (state && state.fetchStatus !== "idle") {
      try {
        await queryClient.fetchInfiniteQuery({ ...queryOptions, staleTime: 0 });
      } catch {
        /** The correction can recover a failed request; cancellation is checked below. */
      }
      signal?.throwIfAborted();
      state = queryClient.getQueryState(queryKey);
    }
  }
  signal?.throwIfAborted();

  let retained = queryClient.getQueryData<InfiniteData<CandleHistoryPage, CandleHistoryRange>>(queryKey);
  let correctedRange = range;
  const identity = queryKey[1];
  function intersects(page: CandleHistoryPage): boolean {
    const end = identity.followLatest && page.from === identity.from ? Math.max(page.to, Date.now()) : page.to;
    return !correctedRange || (page.from < correctedRange.to && end > correctedRange.from);
  }
  if (range && retained && !retained.pages.some(intersects)) return;

  try {
    await queryClient.fetchInfiniteQuery({
      ...queryOptions,
      staleTime: 0,
      queryFn: (context) => {
        context.signal.throwIfAborted();
        const cached = retained?.pages.find((page) => page.from === context.pageParam.from);
        return correctedRange && cached && !intersects(cached) ? cached : queryOptions.queryFn(context);
      },
    });
  } finally {
    /** Later invalidations must perform normal full refetches, including without an observer. */
    correctedRange = undefined;
    retained = undefined;
  }
}
