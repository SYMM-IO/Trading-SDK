import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getPoolQuotes, type GetPoolQuotesParameters, type GetPoolQuotesReturnType } from "./get-pool-quotes";

/** Data resolved by the {@link getPoolQuotesQueryOptions} query. */
export type GetPoolQuotesData = GetPoolQuotesReturnType;

/**
 * Build the TanStack Query key for {@link getPoolQuotesQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolQuotesQueryKey(options: Compute<GetPoolQuotesParameters & ConfigKeyParameter>) {
  return ["getPoolQuotes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPoolQuotesQueryKey}. */
export type GetPoolQuotesQueryKey = ReturnType<typeof getPoolQuotesQueryKey>;

/**
 * Options accepted by {@link getPoolQuotesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPoolQuotesOptions = Compute<
  GetPoolQuotesParameters & QueryParameter<GetPoolQuotesData, Error, GetPoolQuotesData, GetPoolQuotesQueryKey>
>;

/** TanStack Query options returned by {@link getPoolQuotesQueryOptions}. */
export type GetPoolQuotesQueryOptions = SymmioQueryOptions<
  GetPoolQuotesData,
  Error,
  GetPoolQuotesData,
  GetPoolQuotesQueryKey
>;

/**
 * Build TanStack Query options for {@link getPoolQuotes}.
 *
 * Disabled automatically while `symbolId` is absent: a pool with no solver
 * market has no book, so there is nothing to ask for.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getPoolQuotesQueryOptions(config: Config, options: GetPoolQuotesOptions): GetPoolQuotesQueryOptions {
  return {
    ...options.query,
    queryKey: getPoolQuotesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId !== null && options.symbolId !== undefined,
    queryFn: () =>
      getPoolQuotes(config, {
        chainId: options.chainId,
        symbolId: options.symbolId,
        quoteStatuses: options.quoteStatuses,
        first: options.first,
        skip: options.skip,
        orderDirection: options.orderDirection,
      }),
  };
}
