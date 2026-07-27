import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMarkets, type GetMarketsParameters, type GetMarketsReturnType } from "./get-markets";

/** Data resolved by the {@link getMarketsQueryOptions} query. */
export type GetMarketsData = GetMarketsReturnType;

/**
 * Build the TanStack Query key for {@link getMarketsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getMarketsQueryKey(options: Compute<GetMarketsParameters & ConfigKeyParameter> = {}) {
  return ["getMarkets", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarketsQueryKey}. */
export type GetMarketsQueryKey = ReturnType<typeof getMarketsQueryKey>;

/**
 * Options accepted by {@link getMarketsQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetMarketsOptions = Compute<
  GetMarketsParameters & QueryParameter<GetMarketsData, Error, GetMarketsData, GetMarketsQueryKey>
>;

/** TanStack Query options returned by {@link getMarketsQueryOptions}. */
export type GetMarketsQueryOptions = SymmioQueryOptions<GetMarketsData, Error, GetMarketsData, GetMarketsQueryKey>;

/**
 * Build TanStack Query options for {@link getMarkets}. An unsupported chain
 * surfaces a {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarketsQueryOptions(config, { chainId }));
 * ```
 */
export function getMarketsQueryOptions(config: Config, options: GetMarketsOptions = {}): GetMarketsQueryOptions {
  return {
    ...options.query,
    queryKey: getMarketsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMarkets(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
