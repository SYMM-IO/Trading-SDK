import type { Compute } from "../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../shared/types/query";
import { filterQueryOptions } from "../shared/utils/query";
import type { CandleSource, GetCandlesParameters, GetCandlesReturnType } from "./types";

/** Data resolved by the {@link getCandlesQueryOptions} query. */
export type GetCandlesData = GetCandlesReturnType;

/**
 * The identifying half of {@link GetCandlesOptions}: everything that decides
 * which bars are being asked for.
 *
 * `signal` is excluded — cancellation is TanStack's concern, not part of the
 * request's identity.
 */
export type GetCandlesQueryKeyParameters = Compute<
  Omit<GetCandlesParameters, "signal"> & {
    /** {@link CandleSource.id}, so two sources never share a cache entry. */
    sourceId: string;
  }
>;

/**
 * Build the TanStack Query key for {@link getCandlesQueryOptions}.
 *
 * @param options - Source id, market, resolution, and range.
 * @returns A stable, hashable query key.
 */
export function getCandlesQueryKey(options: GetCandlesQueryKeyParameters) {
  return ["getCandles", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getCandlesQueryKey}. */
export type GetCandlesQueryKey = ReturnType<typeof getCandlesQueryKey>;

/**
 * Options accepted by {@link getCandlesQueryOptions}: the range to fetch plus
 * TanStack overrides.
 */
export type GetCandlesOptions = Compute<
  Omit<GetCandlesParameters, "signal"> & QueryParameter<GetCandlesData, Error, GetCandlesData, GetCandlesQueryKey>
>;

/** TanStack Query options returned by {@link getCandlesQueryOptions}. */
export type GetCandlesQueryOptions = SymmioQueryOptions<GetCandlesData, Error, GetCandlesData, GetCandlesQueryKey>;

/**
 * Build TanStack Query options for a {@link CandleSource}'s historical bars.
 *
 * Unlike the chain-scoped factories in the SDK, this takes a source rather than
 * a {@link Config}: which venue to chart is the consumer's choice, not a
 * property of the SYMMIO deployment. The source's `id` is folded into the query
 * key so switching venues does not read another venue's cached bars.
 *
 * @param source - The candle source to read from.
 * @param options - Market, resolution, range, and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getCandlesQueryOptions(source, {
 *     marketName: "BTCUSDT",
 *     resolution: "1m",
 *     from: Date.now() - 3_600_000,
 *     to: Date.now(),
 *   }),
 * );
 * ```
 */
export function getCandlesQueryOptions(source: CandleSource, options: GetCandlesOptions): GetCandlesQueryOptions {
  const { marketName, resolution, from, to, limit } = options;

  return {
    ...options.query,
    queryKey: getCandlesQueryKey({ sourceId: source.id, marketName, resolution, from, to, limit }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => source.getCandles({ marketName, resolution, from, to, limit }),
  };
}
