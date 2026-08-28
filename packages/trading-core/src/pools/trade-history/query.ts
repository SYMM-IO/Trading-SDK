import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolTradeHistory,
  type GetPoolTradeHistoryParameters,
  type GetPoolTradeHistoryReturnType,
} from "./get-pool-trade-history";

/** Data resolved by the {@link getPoolTradeHistoryQueryOptions} query. */
export type GetPoolTradeHistoryData = GetPoolTradeHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getPoolTradeHistoryQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolTradeHistoryQueryKey(options: Compute<GetPoolTradeHistoryParameters & ConfigKeyParameter>) {
  return ["getPoolTradeHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPoolTradeHistoryQueryKey}. */
export type GetPoolTradeHistoryQueryKey = ReturnType<typeof getPoolTradeHistoryQueryKey>;

/**
 * Options accepted by {@link getPoolTradeHistoryQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPoolTradeHistoryOptions = Compute<
  GetPoolTradeHistoryParameters &
    QueryParameter<GetPoolTradeHistoryData, Error, GetPoolTradeHistoryData, GetPoolTradeHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getPoolTradeHistoryQueryOptions}. */
export type GetPoolTradeHistoryQueryOptions = SymmioQueryOptions<
  GetPoolTradeHistoryData,
  Error,
  GetPoolTradeHistoryData,
  GetPoolTradeHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getPoolTradeHistory}.
 *
 * Disabled automatically while `symbolId` is absent: a pool with no solver
 * market has no history to read.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getPoolTradeHistoryQueryOptions(
  config: Config,
  options: GetPoolTradeHistoryOptions,
): GetPoolTradeHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getPoolTradeHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId !== null && options.symbolId !== undefined,
    queryFn: () =>
      getPoolTradeHistory(config, {
        chainId: options.chainId,
        symbolId: options.symbolId,
        closeType: options.closeType,
        first: options.first,
        skip: options.skip,
        orderDirection: options.orderDirection,
      }),
  };
}
