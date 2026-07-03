import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServicePricesByNames,
  type GetEnigmaPriceServicePricesByNamesParameters,
  type GetEnigmaPriceServicePricesByNamesReturnType,
} from "./get-enigma-price-service-prices-by-names";

/** Data resolved by the {@link getEnigmaPriceServicePricesByNamesQueryOptions} query. */
export type GetEnigmaPriceServicePricesByNamesData = GetEnigmaPriceServicePricesByNamesReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServicePricesByNamesQueryOptions}.
 *
 * @param options - Query parameters (chain id, market names, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServicePricesByNamesQueryKey(
  options: Compute<GetEnigmaPriceServicePricesByNamesParameters & ConfigKeyParameter>,
) {
  return ["getEnigmaPriceServicePricesByNames", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServicePricesByNamesQueryKey}. */
export type GetEnigmaPriceServicePricesByNamesQueryKey = ReturnType<typeof getEnigmaPriceServicePricesByNamesQueryKey>;

/**
 * Options accepted by {@link getEnigmaPriceServicePricesByNamesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServicePricesByNamesOptions = Compute<
  GetEnigmaPriceServicePricesByNamesParameters &
    QueryParameter<
      GetEnigmaPriceServicePricesByNamesData,
      Error,
      GetEnigmaPriceServicePricesByNamesData,
      GetEnigmaPriceServicePricesByNamesQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServicePricesByNamesQueryOptions}. */
export type GetEnigmaPriceServicePricesByNamesQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServicePricesByNamesData,
  Error,
  GetEnigmaPriceServicePricesByNamesData,
  GetEnigmaPriceServicePricesByNamesQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServicePricesByNames}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getEnigmaPriceServicePricesByNamesQueryOptions(config, { names: ["BTCUSDT"] }),
 * );
 * ```
 */
export function getEnigmaPriceServicePricesByNamesQueryOptions(
  config: Config,
  options: GetEnigmaPriceServicePricesByNamesOptions,
): GetEnigmaPriceServicePricesByNamesQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServicePricesByNamesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getEnigmaPriceServicePricesByNames(config, {
        chainId: options.chainId,
        names: options.names,
      }),
  };
}
