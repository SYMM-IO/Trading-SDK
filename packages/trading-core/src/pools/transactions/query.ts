import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolTransactions,
  type GetPoolTransactionsParameters,
  type GetPoolTransactionsReturnType,
} from "./get-pool-transactions";

/** Data resolved by the {@link getPoolTransactionsQueryOptions} query. */
export type GetPoolTransactionsData = GetPoolTransactionsReturnType;

/**
 * Build the TanStack Query key for {@link getPoolTransactionsQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolTransactionsQueryKey(options: Compute<GetPoolTransactionsParameters & ConfigKeyParameter>) {
  return ["getPoolTransactions", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPoolTransactionsQueryKey}. */
export type GetPoolTransactionsQueryKey = ReturnType<typeof getPoolTransactionsQueryKey>;

/**
 * Options accepted by {@link getPoolTransactionsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPoolTransactionsOptions = Compute<
  GetPoolTransactionsParameters &
    QueryParameter<GetPoolTransactionsData, Error, GetPoolTransactionsData, GetPoolTransactionsQueryKey>
>;

/** TanStack Query options returned by {@link getPoolTransactionsQueryOptions}. */
export type GetPoolTransactionsQueryOptions = SymmioQueryOptions<
  GetPoolTransactionsData,
  Error,
  GetPoolTransactionsData,
  GetPoolTransactionsQueryKey
>;

/**
 * Build TanStack Query options for {@link getPoolTransactions}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getPoolTransactionsQueryOptions(
  config: Config,
  options: GetPoolTransactionsOptions,
): GetPoolTransactionsQueryOptions {
  return {
    ...options.query,
    queryKey: getPoolTransactionsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getPoolTransactions(config, {
        chainId: options.chainId,
        marketAddress: options.marketAddress,
        walletAddress: options.walletAddress,
        start: options.start,
        size: options.size,
      }),
  };
}
