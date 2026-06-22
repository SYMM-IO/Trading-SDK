import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getQuoteHistory, type GetQuoteHistoryParameters, type GetQuoteHistoryReturnType } from "./get-quote-history";

/** Data resolved by the {@link getQuoteHistoryQueryOptions} query. */
export type GetQuoteHistoryData = GetQuoteHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getQuoteHistoryQueryOptions}.
 *
 * @param options - Query parameters (accounts, close type, paging, time range, chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getQuoteHistoryQueryKey(options: Compute<GetQuoteHistoryParameters & ConfigKeyParameter>) {
  return ["getQuoteHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getQuoteHistoryQueryKey}. */
export type GetQuoteHistoryQueryKey = ReturnType<typeof getQuoteHistoryQueryKey>;

/**
 * Options accepted by {@link getQuoteHistoryQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetQuoteHistoryOptions = Compute<
  GetQuoteHistoryParameters & QueryParameter<GetQuoteHistoryData, Error, GetQuoteHistoryData, GetQuoteHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getQuoteHistoryQueryOptions}. */
export type GetQuoteHistoryQueryOptions = SymmioQueryOptions<
  GetQuoteHistoryData,
  Error,
  GetQuoteHistoryData,
  GetQuoteHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteHistory}. Pass
 * `query.refetchInterval` to poll; the query is disabled until at least one
 * `subAccount` is supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getQuoteHistoryQueryOptions(config, {
 *     subAccounts: ["0xsub…"],
 *     query: { refetchInterval: 20_000 },
 *   }),
 * );
 * ```
 */
export function getQuoteHistoryQueryOptions(
  config: Config,
  options: GetQuoteHistoryOptions,
): GetQuoteHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.subAccounts.length > 0,
    queryFn: () =>
      getQuoteHistory(config, {
        chainId: options.chainId,
        subAccounts: options.subAccounts,
        closeType: options.closeType,
        first: options.first,
        skip: options.skip,
        startTime: options.startTime,
        endTime: options.endTime,
        orderDirection: options.orderDirection,
      }),
  };
}
