"use client";

import {
  getCandlesQueryOptions,
  type CandleSource,
  type GetCandlesOptions,
  type GetCandlesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Parameters for {@link useCandles}: the source to read from, the range to
 * fetch, and TanStack `query` overrides.
 */
export type UseCandlesParameters = GetCandlesOptions & {
  /** The candle source to read from, e.g. from {@link useBinanceCandleSource}. */
  source: CandleSource;
};

/** Return type of {@link useCandles}. */
export type UseCandlesReturnType = UseQueryResult<GetCandlesReturnType, SymmioRequestError>;

/**
 * Fetch historical bars from a {@link CandleSource}.
 *
 * The source's `id` is part of the query key, so switching venues does not read
 * another venue's cached bars.
 *
 * Note that `from`/`to` are part of the key too. Passing a live `Date.now()`
 * mints a new cache entry on every render — derive the range from state that
 * only changes when the user actually pans or changes resolution.
 *
 * @param parameters - Source, market, resolution, range, and query overrides.
 * @returns A TanStack query result carrying the bars and a `noMoreData` flag.
 *
 * @example
 * ```tsx
 * const source = useBinanceCandleSource();
 * const { data, isLoading } = useCandles({
 *   source,
 *   marketName: "BTCUSDT",
 *   resolution: "1m",
 *   from: rangeStart,
 *   to: rangeEnd,
 * });
 * ```
 */
export function useCandles(parameters: UseCandlesParameters): UseCandlesReturnType {
  const { source, ...options } = parameters;
  const queryOptions = getCandlesQueryOptions(source, options);

  return useQuery({
    ...queryOptions,
    queryFn: async () => {
      try {
        return await queryOptions.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseCandlesReturnType;
}
