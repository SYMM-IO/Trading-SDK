import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getInventoryTvl, type GetInventoryTvlParameters, type GetInventoryTvlReturnType } from "./get-inventory-tvl";

/** Data resolved by the {@link getInventoryTvlQueryOptions} query. */
export type GetInventoryTvlData = GetInventoryTvlReturnType;

/**
 * Build the TanStack Query key for {@link getInventoryTvlQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getInventoryTvlQueryKey(options: Compute<GetInventoryTvlParameters & ConfigKeyParameter>) {
  return ["getInventoryTvl", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInventoryTvlQueryKey}. */
export type GetInventoryTvlQueryKey = ReturnType<typeof getInventoryTvlQueryKey>;

/**
 * Options accepted by {@link getInventoryTvlQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetInventoryTvlOptions = Compute<
  GetInventoryTvlParameters & QueryParameter<GetInventoryTvlData, Error, GetInventoryTvlData, GetInventoryTvlQueryKey>
>;

/** TanStack Query options returned by {@link getInventoryTvlQueryOptions}. */
export type GetInventoryTvlQueryOptions = SymmioQueryOptions<
  GetInventoryTvlData,
  Error,
  GetInventoryTvlData,
  GetInventoryTvlQueryKey
>;

/**
 * Build TanStack Query options for {@link getInventoryTvl}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getInventoryTvlQueryOptions(config));
 * ```
 */
export function getInventoryTvlQueryOptions(
  config: Config,
  options: GetInventoryTvlOptions = {},
): GetInventoryTvlQueryOptions {
  return {
    ...options.query,
    queryKey: getInventoryTvlQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getInventoryTvl(config, { chainId: options.chainId }),
  };
}
