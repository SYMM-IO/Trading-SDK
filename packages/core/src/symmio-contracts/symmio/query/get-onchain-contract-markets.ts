import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getOnchainContractMarkets,
  type GetOnchainContractMarketsParameters,
  type GetOnchainContractMarketsReturnType,
} from "../actions/get-onchain-contract-markets";

/** Data resolved by the {@link getOnchainContractMarketsQueryOptions} query. */
export type GetOnchainContractMarketsData = GetOnchainContractMarketsReturnType;

/**
 * Build the TanStack Query key for {@link getOnchainContractMarketsQueryOptions}.
 *
 * @param options - Query parameters (chain id, start, size).
 * @returns A stable, hashable query key.
 */
export function getOnchainContractMarketsQueryKey(
  options: Compute<GetOnchainContractMarketsParameters & ConfigKeyParameter>,
) {
  return ["getOnchainContractMarkets", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getOnchainContractMarketsQueryKey}. */
export type GetOnchainContractMarketsQueryKey = ReturnType<typeof getOnchainContractMarketsQueryKey>;

/**
 * Options accepted by {@link getOnchainContractMarketsQueryOptions}: the
 * action's parameters, an optional cache scope, and TanStack overrides.
 */
export type GetOnchainContractMarketsOptions = Compute<
  GetOnchainContractMarketsParameters &
    QueryParameter<
      GetOnchainContractMarketsData,
      Error,
      GetOnchainContractMarketsData,
      GetOnchainContractMarketsQueryKey
    >
>;

/** TanStack Query options returned by {@link getOnchainContractMarketsQueryOptions}. */
export type GetOnchainContractMarketsQueryOptions = SymmioQueryOptions<
  GetOnchainContractMarketsData,
  Error,
  GetOnchainContractMarketsData,
  GetOnchainContractMarketsQueryKey
>;

/**
 * Build TanStack Query options for {@link getOnchainContractMarkets}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getOnchainContractMarketsQueryOptions(config, { start: 0, size: 100 }));
 * ```
 */
export function getOnchainContractMarketsQueryOptions(
  config: Config,
  options: GetOnchainContractMarketsOptions,
): GetOnchainContractMarketsQueryOptions {
  return {
    ...options.query,
    queryKey: getOnchainContractMarketsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getOnchainContractMarkets(config, { chainId: options.chainId, start: options.start, size: options.size }),
  };
}
