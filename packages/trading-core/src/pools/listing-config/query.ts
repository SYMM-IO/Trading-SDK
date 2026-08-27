import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingConfig,
  type GetListingConfigParameters,
  type GetListingConfigReturnType,
} from "./get-listing-config";

/** Data resolved by the {@link getListingConfigQueryOptions} query. */
export type GetListingConfigData = GetListingConfigReturnType;

/**
 * Build the TanStack Query key for {@link getListingConfigQueryOptions}.
 *
 * @param options - The action's parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getListingConfigQueryKey(options: Compute<GetListingConfigParameters & ConfigKeyParameter> = {}) {
  return ["getListingConfig", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getListingConfigQueryKey}. */
export type GetListingConfigQueryKey = ReturnType<typeof getListingConfigQueryKey>;

/**
 * Options accepted by {@link getListingConfigQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetListingConfigOptions = Compute<
  GetListingConfigParameters &
    QueryParameter<GetListingConfigData, Error, GetListingConfigData, GetListingConfigQueryKey>
>;

/** TanStack Query options returned by {@link getListingConfigQueryOptions}. */
export type GetListingConfigQueryOptions = SymmioQueryOptions<
  GetListingConfigData,
  Error,
  GetListingConfigData,
  GetListingConfigQueryKey
>;

/**
 * Build TanStack Query options for {@link getListingConfig}.
 *
 * @param config - The SDK config.
 * @param options - Optional chain/solver overrides and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getListingConfigQueryOptions(config));
 * ```
 */
export function getListingConfigQueryOptions(
  config: Config,
  options: GetListingConfigOptions = {},
): GetListingConfigQueryOptions {
  return {
    ...options.query,
    queryKey: getListingConfigQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getListingConfig(config, {
        chainId: options.chainId,
      }),
  };
}
