"use client";

import {
  getCandleHistoryQueryOptions,
  refreshCandleHistory,
  type CandleHistoryData,
  type CandleHistoryRange,
  type CandleSource,
  type GetCandleHistoryOptions,
  type GetCandleHistoryQueryOptions,
} from "@symmio/trading-core";
import { hashKey, useInfiniteQuery, useQueryClient, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/** Source, stable initial range, follow-latest policy, and TanStack overrides for {@link useCandleHistory}. */
export type UseCandleHistoryParameters = GetCandleHistoryOptions & { source: CandleSource };

/** Incremental history state, with merged `data.candles` and explicit loading and refresh actions. */
export type UseCandleHistoryReturnType = UseInfiniteQueryResult<CandleHistoryData, SymmioRequestError> & {
  /** Fetch only the preceding window. Repeated calls while fetching are ignored; errors require refresh. */
  loadOlder: () => Promise<void>;
  /** Revalidate all windows, or only those intersecting range. Bounded refreshes wait for active paging. */
  refresh: (range?: CandleHistoryRange) => Promise<void>;
};

/**
 * Retain candle history while loading preceding windows through any CandleSource.
 * Cursor calculation and merging live in core; this hook supplies React lifecycle,
 * cancellation, and normalized errors. An empty window never triggers another load.
 *
 * @param parameters - Source, market, resolution, and a stable initial range.
 * @returns Query state with ascending candles, loadOlder, and refresh.
 * @example
 * ```tsx
 * const history = useCandleHistory({ source, marketName, resolution, ...initialRange, followLatest: true });
 * const stream = useCandleStream({ source, marketName, resolution, onReset: (range) => { void history.refresh(range); } });
 * // Wire history.loadOlder to your chart's older-edge gesture.
 * ```
 */
export function useCandleHistory(parameters: UseCandleHistoryParameters): UseCandleHistoryReturnType {
  const { source, ...options } = parameters;
  const queryClient = useQueryClient();
  const queryOptions = getCandleHistoryQueryOptions(source, options);
  const normalizedOptions: GetCandleHistoryQueryOptions = {
    ...queryOptions,
    queryFn: async (context) => {
      try {
        return await queryOptions.queryFn(context);
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  };
  const query = useInfiniteQuery(normalizedOptions) as UseInfiniteQueryResult<CandleHistoryData, SymmioRequestError>;
  const key = hashKey(queryOptions.queryKey);
  const optionsRef = useRef(normalizedOptions);
  optionsRef.current = normalizedOptions;
  const lifecycle = useRef<{ key: string; controller: AbortController } | undefined>(undefined);
  useEffect(() => {
    lifecycle.current = { key, controller: new AbortController() };
    return () => {
      if (lifecycle.current?.key === key) {
        lifecycle.current.controller.abort();
        lifecycle.current = undefined;
      }
    };
  }, [key]);

  const { isFetching, error, hasNextPage, fetchNextPage } = query;
  const loadOlder = useCallback(async () => {
    if (isFetching || error || !hasNextPage) return;
    await fetchNextPage({ cancelRefetch: false });
  }, [isFetching, error, hasNextPage, fetchNextPage]);
  const refresh = useCallback(
    async (range?: CandleHistoryRange) => {
      if (lifecycle.current?.key !== key) return;
      if (!range) {
        /** A full refresh supersedes queued corrections for this history. */
        lifecycle.current.controller.abort();
        lifecycle.current = { key, controller: new AbortController() };
      }
      const { signal } = lifecycle.current.controller;
      const original = optionsRef.current;
      try {
        await refreshCandleHistory(queryClient, { queryOptions: original, range, signal });
      } catch (error) {
        /** Request failures are already observable through the shared query state. */
        if (!signal.aborted && !queryClient.getQueryState(original.queryKey)?.error) throw normalizeSymmError(error);
      }
    },
    [key, queryClient],
  );
  return { ...query, loadOlder, refresh };
}
