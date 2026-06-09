import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServicePricesByAddresses,
  type GetEnigmaPriceServicePricesByAddressesParameters,
  type GetEnigmaPriceServicePricesByAddressesReturnType,
} from "./get-enigma-price-service-prices-by-addresses";

/** Data resolved by the {@link getEnigmaPriceServicePricesByAddressesQueryOptions} query. */
export type GetEnigmaPriceServicePricesByAddressesData = GetEnigmaPriceServicePricesByAddressesReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServicePricesByAddressesQueryOptions}.
 *
 * @param options - Query parameters (chain id, symbol addresses, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServicePricesByAddressesQueryKey(
  options: Compute<GetEnigmaPriceServicePricesByAddressesParameters & ConfigKeyParameter>,
) {
  return ["getEnigmaPriceServicePricesByAddresses", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServicePricesByAddressesQueryKey}. */
export type GetEnigmaPriceServicePricesByAddressesQueryKey = ReturnType<
  typeof getEnigmaPriceServicePricesByAddressesQueryKey
>;

/**
 * Options accepted by {@link getEnigmaPriceServicePricesByAddressesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServicePricesByAddressesOptions = Compute<
  GetEnigmaPriceServicePricesByAddressesParameters &
    QueryParameter<
      GetEnigmaPriceServicePricesByAddressesData,
      Error,
      GetEnigmaPriceServicePricesByAddressesData,
      GetEnigmaPriceServicePricesByAddressesQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServicePricesByAddressesQueryOptions}. */
export type GetEnigmaPriceServicePricesByAddressesQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServicePricesByAddressesData,
  Error,
  GetEnigmaPriceServicePricesByAddressesData,
  GetEnigmaPriceServicePricesByAddressesQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServicePricesByAddresses}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getEnigmaPriceServicePricesByAddressesQueryOptions(config, { addresses: [symbolAddress] }),
 * );
 * ```
 */
export function getEnigmaPriceServicePricesByAddressesQueryOptions(
  config: Config,
  options: GetEnigmaPriceServicePricesByAddressesOptions,
): GetEnigmaPriceServicePricesByAddressesQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServicePricesByAddressesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getEnigmaPriceServicePricesByAddresses(config, {
        chainId: options.chainId,
        addresses: options.addresses,
      }),
  };
}
