import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServicePrices,
  type GetEnigmaPriceServicePricesParameters,
  type GetEnigmaPriceServicePricesReturnType,
} from "./get-enigma-price-service-prices";

/** Data resolved by the {@link getEnigmaPriceServicePricesQueryOptions} query. */
export type GetEnigmaPriceServicePricesData = GetEnigmaPriceServicePricesReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServicePricesQueryOptions}.
 *
 * @param options - Query parameters (chain id, symbol addresses, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServicePricesQueryKey(
  options: Compute<GetEnigmaPriceServicePricesParameters & ConfigKeyParameter>,
) {
  return ["getEnigmaPriceServicePrices", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServicePricesQueryKey}. */
export type GetEnigmaPriceServicePricesQueryKey = ReturnType<typeof getEnigmaPriceServicePricesQueryKey>;

/**
 * Options accepted by {@link getEnigmaPriceServicePricesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServicePricesOptions = Compute<
  GetEnigmaPriceServicePricesParameters &
    QueryParameter<
      GetEnigmaPriceServicePricesData,
      Error,
      GetEnigmaPriceServicePricesData,
      GetEnigmaPriceServicePricesQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServicePricesQueryOptions}. */
export type GetEnigmaPriceServicePricesQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServicePricesData,
  Error,
  GetEnigmaPriceServicePricesData,
  GetEnigmaPriceServicePricesQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServicePrices}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getEnigmaPriceServicePricesQueryOptions(config, { addresses: [symbolAddress] }));
 * ```
 */
export function getEnigmaPriceServicePricesQueryOptions(
  config: Config,
  options: GetEnigmaPriceServicePricesOptions,
): GetEnigmaPriceServicePricesQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServicePricesQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaPriceServicePrices(config, { chainId: options.chainId, addresses: options.addresses }),
  };
}
