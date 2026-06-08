import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServiceHealth,
  type GetEnigmaPriceServiceHealthParameters,
  type GetEnigmaPriceServiceHealthReturnType,
} from "./get-enigma-price-service-health";

/** Data resolved by the {@link getEnigmaPriceServiceHealthQueryOptions} query. */
export type GetEnigmaPriceServiceHealthData = GetEnigmaPriceServiceHealthReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServiceHealthQueryOptions}.
 *
 * @param options - Query parameters (chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServiceHealthQueryKey(
  options: Compute<GetEnigmaPriceServiceHealthParameters & ConfigKeyParameter> = {},
) {
  return ["getEnigmaPriceServiceHealth", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServiceHealthQueryKey}. */
export type GetEnigmaPriceServiceHealthQueryKey = ReturnType<typeof getEnigmaPriceServiceHealthQueryKey>;

/**
 * Options accepted by {@link getEnigmaPriceServiceHealthQueryOptions}: optional
 * action parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServiceHealthOptions = Compute<
  GetEnigmaPriceServiceHealthParameters &
    QueryParameter<
      GetEnigmaPriceServiceHealthData,
      Error,
      GetEnigmaPriceServiceHealthData,
      GetEnigmaPriceServiceHealthQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServiceHealthQueryOptions}. */
export type GetEnigmaPriceServiceHealthQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServiceHealthData,
  Error,
  GetEnigmaPriceServiceHealthData,
  GetEnigmaPriceServiceHealthQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServiceHealth}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getEnigmaPriceServiceHealthQueryOptions(config, {}));
 * ```
 */
export function getEnigmaPriceServiceHealthQueryOptions(
  config: Config,
  options: GetEnigmaPriceServiceHealthOptions = {},
): GetEnigmaPriceServiceHealthQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServiceHealthQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaPriceServiceHealth(config, { chainId: options.chainId }),
  };
}
