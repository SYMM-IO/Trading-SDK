import type { InfiniteData, QueryClient } from "@tanstack/query-core";
import { validateCandleHistoryRange, type CandleHistoryPage, type GetCandleHistoryQueryOptions } from "./history-query";
import { resolutionToMs } from "./resolution";
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
 * correction and fetches only corrected intervals plus any missing live tail. A full refresh cancels an active request before revalidating all
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
        if (!correctedRange || !cached) return queryOptions.queryFn(context);
        if (!intersects(cached)) return cached;
        const end =
          identity.followLatest && cached.from === identity.from ? Math.max(cached.to, Date.now()) : cached.to;
        /** Overlap the unfinished bucket without assuming the source's alignment.
         * A calendar month can span 31 days; its nominal 30-day length is insufficient. */
        const overlap = identity.resolution === "1M" ? 31 * 86_400_000 : resolutionToMs(identity.resolution);
        return refreshPage(cached, correctedRange, end, overlap, queryOptions.fetchRange, context.signal);
      },
    });
  } finally {
    /** Later invalidations must perform normal full refetches, including without an observer. */
    correctedRange = undefined;
    retained = undefined;
  }
}

/** Replace exact intervals, including deleted candles; keep the original paging boundary. */
async function refreshPage(
  page: CandleHistoryPage,
  correction: CandleHistoryRange,
  end: number,
  overlap: number,
  fetchRange: GetCandleHistoryQueryOptions["fetchRange"],
  signal: AbortSignal,
): Promise<CandleHistoryPage> {
  const ranges: CandleHistoryRange[] = [];
  const from = Math.max(page.from, correction.from);
  const to = Math.min(page.to, correction.to);
  if (from < to) ranges.push({ from, to });
  if (end > page.to) {
    const tailFrom = Math.max(page.from, page.to - overlap);
    const last = ranges.at(-1);
    if (last && last.to >= tailFrom) {
      last.from = Math.min(last.from, tailFrom);
      last.to = end;
    } else ranges.push({ from: tailFrom, to: end });
  }
  let candles = page.candles;
  let noMoreData = page.noMoreData;
  for (const range of ranges) {
    const fresh = await fetchRange(range, signal);
    candles = [
      ...candles.filter((bar) => bar.time < range.from || bar.time >= range.to),
      ...fresh.candles.filter((bar) => bar.time >= range.from && bar.time < range.to),
    ];
    if (range.from === page.from) noMoreData = fresh.noMoreData;
  }
  return { ...page, to: end, noMoreData, candles: candles.sort((a, b) => a.time - b.time) };
}
