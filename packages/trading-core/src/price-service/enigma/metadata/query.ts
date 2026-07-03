import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServiceMetadata,
  type GetEnigmaPriceServiceMetadataParameters,
  type GetEnigmaPriceServiceMetadataReturnType,
} from "./get-enigma-price-service-metadata";

/** Data resolved by the {@link getEnigmaPriceServiceMetadataQueryOptions} query. */
export type GetEnigmaPriceServiceMetadataData = GetEnigmaPriceServiceMetadataReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServiceMetadataQueryOptions}.
 *
 * @param options - Query parameters (chain id, symbol addresses, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServiceMetadataQueryKey(
  options: Compute<GetEnigmaPriceServiceMetadataParameters & ConfigKeyParameter>,
) {
  return ["getEnigmaPriceServiceMetadata", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServiceMetadataQueryKey}. */
export type GetEnigmaPriceServiceMetadataQueryKey = ReturnType<typeof getEnigmaPriceServiceMetadataQueryKey>;

/**
 * Options accepted by {@link getEnigmaPriceServiceMetadataQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServiceMetadataOptions = Compute<
  GetEnigmaPriceServiceMetadataParameters &
    QueryParameter<
      GetEnigmaPriceServiceMetadataData,
      Error,
      GetEnigmaPriceServiceMetadataData,
      GetEnigmaPriceServiceMetadataQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServiceMetadataQueryOptions}. */
export type GetEnigmaPriceServiceMetadataQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServiceMetadataData,
  Error,
  GetEnigmaPriceServiceMetadataData,
  GetEnigmaPriceServiceMetadataQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServiceMetadata}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getEnigmaPriceServiceMetadataQueryOptions(config, { addresses: [symbolAddress] }));
 * ```
 */
export function getEnigmaPriceServiceMetadataQueryOptions(
  config: Config,
  options: GetEnigmaPriceServiceMetadataOptions,
): GetEnigmaPriceServiceMetadataQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServiceMetadataQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaPriceServiceMetadata(config, { chainId: options.chainId, addresses: options.addresses }),
  };
}
