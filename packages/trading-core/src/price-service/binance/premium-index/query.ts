import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getBinancePremiumIndex,
  type GetBinancePremiumIndexParameters,
  type GetBinancePremiumIndexReturnType,
} from "./get-binance-premium-index";

/** Data resolved by the {@link getBinancePremiumIndexQueryOptions} query. */
export type GetBinancePremiumIndexData = GetBinancePremiumIndexReturnType;

/**
 * Build the TanStack Query key for {@link getBinancePremiumIndexQueryOptions}.
 *
 * @param options - Query parameters (chain id, solver id, names, config key).
 * @returns A stable, hashable query key.
 */
export function getBinancePremiumIndexQueryKey(
  options: Compute<GetBinancePremiumIndexParameters & ConfigKeyParameter> = {},
) {
  return ["getBinancePremiumIndex", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getBinancePremiumIndexQueryKey}. */
export type GetBinancePremiumIndexQueryKey = ReturnType<typeof getBinancePremiumIndexQueryKey>;

/** Options accepted by {@link getBinancePremiumIndexQueryOptions}. */
export type GetBinancePremiumIndexOptions = Compute<
  GetBinancePremiumIndexParameters &
    QueryParameter<GetBinancePremiumIndexData, Error, GetBinancePremiumIndexData, GetBinancePremiumIndexQueryKey>
>;

/** TanStack Query options returned by {@link getBinancePremiumIndexQueryOptions}. */
export type GetBinancePremiumIndexQueryOptions = SymmioQueryOptions<
  GetBinancePremiumIndexData,
  Error,
  GetBinancePremiumIndexData,
  GetBinancePremiumIndexQueryKey
>;

/**
 * Build TanStack Query options for {@link getBinancePremiumIndex}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getBinancePremiumIndexQueryOptions(
  config: Config,
  options: GetBinancePremiumIndexOptions = {},
): GetBinancePremiumIndexQueryOptions {
  return {
    ...options.query,
    queryKey: getBinancePremiumIndexQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    /** Every identifying parameter is enumerated — see ARCHITECTURE.md §3.5. */
    queryFn: () =>
      getBinancePremiumIndex(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        names: options.names,
      }),
  };
}
