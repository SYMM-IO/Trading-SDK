import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getEnigmaPriceServiceSymbolsInfo,
  type GetEnigmaPriceServiceSymbolsInfoParameters,
  type GetEnigmaPriceServiceSymbolsInfoReturnType,
} from "./get-enigma-price-service-symbols-info";

/** Data resolved by the {@link getEnigmaPriceServiceSymbolsInfoQueryOptions} query. */
export type GetEnigmaPriceServiceSymbolsInfoData = GetEnigmaPriceServiceSymbolsInfoReturnType;

/**
 * Build the TanStack Query key for {@link getEnigmaPriceServiceSymbolsInfoQueryOptions}.
 *
 * @param options - Query parameters (chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getEnigmaPriceServiceSymbolsInfoQueryKey(
  options: Compute<GetEnigmaPriceServiceSymbolsInfoParameters & ConfigKeyParameter> = {},
) {
  return ["getEnigmaPriceServiceSymbolsInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getEnigmaPriceServiceSymbolsInfoQueryKey}. */
export type GetEnigmaPriceServiceSymbolsInfoQueryKey = ReturnType<typeof getEnigmaPriceServiceSymbolsInfoQueryKey>;

/**
 * Options accepted by {@link getEnigmaPriceServiceSymbolsInfoQueryOptions}: optional action
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetEnigmaPriceServiceSymbolsInfoOptions = Compute<
  GetEnigmaPriceServiceSymbolsInfoParameters &
    QueryParameter<
      GetEnigmaPriceServiceSymbolsInfoData,
      Error,
      GetEnigmaPriceServiceSymbolsInfoData,
      GetEnigmaPriceServiceSymbolsInfoQueryKey
    >
>;

/** TanStack Query options returned by {@link getEnigmaPriceServiceSymbolsInfoQueryOptions}. */
export type GetEnigmaPriceServiceSymbolsInfoQueryOptions = SymmioQueryOptions<
  GetEnigmaPriceServiceSymbolsInfoData,
  Error,
  GetEnigmaPriceServiceSymbolsInfoData,
  GetEnigmaPriceServiceSymbolsInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getEnigmaPriceServiceSymbolsInfo}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {}));
 * ```
 */
export function getEnigmaPriceServiceSymbolsInfoQueryOptions(
  config: Config,
  options: GetEnigmaPriceServiceSymbolsInfoOptions = {},
): GetEnigmaPriceServiceSymbolsInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getEnigmaPriceServiceSymbolsInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaPriceServiceSymbolsInfo(config, { chainId: options.chainId }),
  };
}
