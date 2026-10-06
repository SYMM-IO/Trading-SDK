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
 * Every filter is part of the key, so differently filtered pages never share a
 * cache entry. The deprecated `marketAddress` folds into `tokenAddress`, so the
 * old and the new spelling of one filter do share one.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolTransactionsQueryKey(options: Compute<GetPoolTransactionsParameters & ConfigKeyParameter>) {
  const { marketAddress, ...parameters } = options;
  return [
    "getPoolTransactions",
    filterQueryOptions({ ...parameters, tokenAddress: parameters.tokenAddress ?? marketAddress }),
  ] as const;
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
 * @param options - Query parameters and TanStack overrides. Omit for every pool's latest page.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getPoolTransactionsQueryOptions(
  config: Config,
  options: GetPoolTransactionsOptions = {},
): GetPoolTransactionsQueryOptions {
  /** Every parameter reaches the action: a hand-listed subset would silently drop a new filter. */
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getPoolTransactionsQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: query?.enabled ?? true,
    queryFn: () => getPoolTransactions(config, parameters),
  };
}
