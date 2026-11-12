import type { InfiniteData, InfiniteQueryObserverOptions, QueryFunctionContext } from "@tanstack/query-core";
import { SymmError } from "../shared/errors/symm-error";
import { mergeCandlePages } from "./merge-candle-pages";
import type { CandleHistoryRange, CandleSource, GetCandlesParameters, GetCandlesReturnType } from "./types";

export type { CandleHistoryRange } from "./types";

/** One requested window and its source response. Empty windows still have a paging cursor. */
export interface CandleHistoryPage extends CandleHistoryRange, GetCandlesReturnType {}

/** Retained pages, newest window first, and their combined candles, oldest candle first. */
export interface CandleHistoryData extends InfiniteData<CandleHistoryPage, CandleHistoryRange>, GetCandlesReturnType {}

/** Initial window for incremental history. Each older request spans the same elapsed time. */
export type GetCandleHistoryParameters = Pick<GetCandlesParameters, "marketName" | "resolution" | "from" | "to"> & {
  /** Advance the newest window's end to the current time on fetch/refetch. Defaults to false. */
  followLatest?: boolean;
};

/** Identity of an incremental history query, scoped to the source and initial window. */
export type GetCandleHistoryQueryKeyParameters = GetCandleHistoryParameters & { sourceId: string };

/**
 * Identify retained history without putting each newly loaded page in a separate query.
 * @param parameters - Source identity, market, resolution, initial range, and follow policy.
 * @returns A stable TanStack Query key.
 */
export function getCandleHistoryQueryKey(parameters: GetCandleHistoryQueryKeyParameters) {
  const { sourceId, marketName, resolution, from, to, followLatest = false } = parameters;
  return ["getCandleHistory", { sourceId, marketName, resolution, from, to, followLatest }] as const;
}

/** Query key produced by {@link getCandleHistoryQueryKey}. */
export type GetCandleHistoryQueryKey = ReturnType<typeof getCandleHistoryQueryKey>;

type ObserverOptions = InfiniteQueryObserverOptions<
  CandleHistoryPage,
  Error,
  CandleHistoryData,
  GetCandleHistoryQueryKey,
  CandleHistoryRange
>;

type OwnedOptions =
  | "queryKey"
  | "queryFn"
  | "queryHash"
  | "queryKeyHashFn"
  | "select"
  | "initialPageParam"
  | "getNextPageParam"
  | "getPreviousPageParam"
  | "maxPages";

/** Initial history window and TanStack overrides. Paging, merging, and query identity are SDK-owned. */
export type GetCandleHistoryOptions = GetCandleHistoryParameters & {
  /** Refetch, retry, enabled, and cache-lifetime options. Retained history is not immutable. */
  query?: Partial<Omit<ObserverOptions, OwnedOptions>>;
};

/** Options accepted by TanStack's InfiniteQueryObserver and framework infinite-query hooks. */
export type GetCandleHistoryQueryOptions = Omit<ObserverOptions, "queryFn"> & {
  /** Fetch exactly this range with cancellation, without extending it for followLatest. Used for corrections. */
  fetchRange: (range: CandleHistoryRange, signal: AbortSignal) => Promise<CandleHistoryPage>;
  /** Fetch one window using the observer's cursor and cancellation signal. */
  queryFn: (context: QueryFunctionContext<GetCandleHistoryQueryKey, CandleHistoryRange>) => Promise<CandleHistoryPage>;
};

/** Validate shared history and correction bounds before requesting data. @internal */
export function validateCandleHistoryRange({ from, to }: CandleHistoryRange) {
  if (
    ![from, to, to - from].every(Number.isSafeInteger) ||
    ![from, to].every((time) => Number.isFinite(new Date(time).getTime())) ||
    from >= to
  ) {
    throw new SymmError(
      "validation",
      "INVALID_CANDLE_RANGE",
      "Candle ranges must be finite integer milliseconds with from < to.",
    );
  }
}

function selectHistory(data: InfiniteData<CandleHistoryPage, CandleHistoryRange>): CandleHistoryData {
  return { ...data, ...mergeCandlePages(data.pages) };
}

/**
 * Build incremental history options for any CandleSource. Fetching the next page
 * loads only the preceding time window; refetching revalidates every retained page.
 * No returned-bar limit is applied, so sparse pages cannot hide part of a window.
 *
 * @param source - Source owning provider paging, bucket alignment, and flat-candle policy.
 * @param options - Initial range and query overrides. Keep the initial range stable.
 * @returns Infinite-query options with merged, ascending candles and source-confirmed exhaustion.
 * @example
 * ```ts
 * const options = getCandleHistoryQueryOptions(source, {
 *   marketName, resolution: "1h", from, to, followLatest: true,
 * });
 * // Pass options to your framework's useInfiniteQuery or InfiniteQueryObserver.
 * ```
 */
export function getCandleHistoryQueryOptions(
  source: CandleSource,
  options: GetCandleHistoryOptions,
): GetCandleHistoryQueryOptions {
  const { marketName, resolution, from, to, followLatest = false } = options;
  const width = to - from;
  async function fetchRange(range: CandleHistoryRange, signal: AbortSignal): Promise<CandleHistoryPage> {
    validateCandleHistoryRange({ from, to });
    validateCandleHistoryRange(range);
    signal.throwIfAborted();
    const result = await source.getCandles({ marketName, resolution, ...range, signal });
    signal.throwIfAborted();
    return { ...result, ...range };
  }
  return {
    ...options.query,
    queryKey: getCandleHistoryQueryKey({ sourceId: source.id, marketName, resolution, from, to, followLatest }),
    initialPageParam: { from, to },
    fetchRange,
    queryFn: async ({ pageParam, signal }) => {
      validateCandleHistoryRange({ from, to });
      const range = {
        from: pageParam.from,
        to: followLatest && pageParam.from === from ? Math.max(to, Date.now()) : pageParam.to,
      };
      return fetchRange(range, signal);
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.noMoreData) return undefined;
      return { from: lastPage.from - width, to: lastPage.from };
    },
    select: selectHistory,
  };
}
