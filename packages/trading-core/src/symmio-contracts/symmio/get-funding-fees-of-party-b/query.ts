import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getFundingFeesOfPartyB,
  type GetFundingFeesOfPartyBParameters,
  type GetFundingFeesOfPartyBReturnType,
} from "./get-funding-fees-of-party-b";

/** Data resolved by the {@link getFundingFeesOfPartyBQueryOptions} query. */
export type GetFundingFeesOfPartyBData = GetFundingFeesOfPartyBReturnType;

/**
 * Build the TanStack Query key for {@link getFundingFeesOfPartyBQueryOptions}.
 *
 * @param options - Query parameters (chain id, symbol id, partyB, config key).
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getFundingFeesOfPartyBQueryKey({ symbolId: 1n, partyB });
 * // → ["getFundingFeesOfPartyB", { symbolId: "1", partyB }]
 * ```
 */
export function getFundingFeesOfPartyBQueryKey(
  options: Compute<GetFundingFeesOfPartyBParameters & ConfigKeyParameter>,
) {
  return ["getFundingFeesOfPartyB", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getFundingFeesOfPartyBQueryKey}. */
export type GetFundingFeesOfPartyBQueryKey = ReturnType<typeof getFundingFeesOfPartyBQueryKey>;

/**
 * Options accepted by {@link getFundingFeesOfPartyBQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetFundingFeesOfPartyBOptions = Compute<
  GetFundingFeesOfPartyBParameters &
    QueryParameter<GetFundingFeesOfPartyBData, Error, GetFundingFeesOfPartyBData, GetFundingFeesOfPartyBQueryKey>
>;

/** TanStack Query options returned by {@link getFundingFeesOfPartyBQueryOptions}. */
export type GetFundingFeesOfPartyBQueryOptions = SymmioQueryOptions<
  GetFundingFeesOfPartyBData,
  Error,
  GetFundingFeesOfPartyBData,
  GetFundingFeesOfPartyBQueryKey
>;

/**
 * Build TanStack Query options for {@link getFundingFeesOfPartyB}. An
 * unsupported chain surfaces a {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getFundingFeesOfPartyBQueryOptions(config, { symbolId: 1n, partyB }));
 * ```
 */
export function getFundingFeesOfPartyBQueryOptions(
  config: Config,
  options: GetFundingFeesOfPartyBOptions,
): GetFundingFeesOfPartyBQueryOptions {
  return {
    ...options.query,
    queryKey: getFundingFeesOfPartyBQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getFundingFeesOfPartyB(config, {
        chainId: options.chainId,
        symbolId: options.symbolId,
        partyB: options.partyB,
      }),
  };
}
