import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getBalanceHistory,
  type GetBalanceHistoryParameters,
  type GetBalanceHistoryReturnType,
} from "./get-balance-history";

/** Data resolved by the {@link getBalanceHistoryQueryOptions} query. */
export type GetBalanceHistoryData = GetBalanceHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getBalanceHistoryQueryOptions}.
 *
 * @param options - Query parameters (accounts, filter, paging, time range, chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getBalanceHistoryQueryKey(options: Compute<GetBalanceHistoryParameters & ConfigKeyParameter>) {
  return ["getBalanceHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getBalanceHistoryQueryKey}. */
export type GetBalanceHistoryQueryKey = ReturnType<typeof getBalanceHistoryQueryKey>;

/**
 * Options accepted by {@link getBalanceHistoryQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetBalanceHistoryOptions = Compute<
  GetBalanceHistoryParameters &
    QueryParameter<GetBalanceHistoryData, Error, GetBalanceHistoryData, GetBalanceHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getBalanceHistoryQueryOptions}. */
export type GetBalanceHistoryQueryOptions = SymmioQueryOptions<
  GetBalanceHistoryData,
  Error,
  GetBalanceHistoryData,
  GetBalanceHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getBalanceHistory}. Pass
 * `query.refetchInterval` to poll; the query is disabled until at least one
 * `account` is supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getBalanceHistoryQueryOptions(config, {
 *     accounts: ["0xsub…"],
 *     filter: BalanceHistoryFilter.Deposit,
 *   }),
 * );
 * ```
 */
export function getBalanceHistoryQueryOptions(
  config: Config,
  options: GetBalanceHistoryOptions,
): GetBalanceHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getBalanceHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.accounts.length > 0,
    queryFn: () =>
      getBalanceHistory(config, {
        chainId: options.chainId,
        accounts: options.accounts,
        filter: options.filter,
        internalTransfers: options.internalTransfers,
        first: options.first,
        skip: options.skip,
        startTime: options.startTime,
        endTime: options.endTime,
        orderDirection: options.orderDirection,
      }),
  };
}
