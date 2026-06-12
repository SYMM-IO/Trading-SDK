import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPartyAOpenPositions,
  type GetPartyAOpenPositionsParameters,
  type GetPartyAOpenPositionsReturnType,
} from "../actions/get-party-a-open-positions";

/** Data resolved by the {@link getPartyAOpenPositionsQueryOptions} query. */
export type GetPartyAOpenPositionsData = GetPartyAOpenPositionsReturnType;

/**
 * Build the TanStack Query key for {@link getPartyAOpenPositionsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, partyA, pagination).
 * @returns A stable, hashable query key.
 */
export function getPartyAOpenPositionsQueryKey(
  options: Compute<ExactPartial<GetPartyAOpenPositionsParameters> & ConfigKeyParameter> = {},
) {
  return ["getPartyAOpenPositions", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPartyAOpenPositionsQueryKey}. */
export type GetPartyAOpenPositionsQueryKey = ReturnType<typeof getPartyAOpenPositionsQueryKey>;

/**
 * Options accepted by {@link getPartyAOpenPositionsQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetPartyAOpenPositionsOptions = Compute<
  ExactPartial<GetPartyAOpenPositionsParameters> &
    QueryParameter<GetPartyAOpenPositionsData, Error, GetPartyAOpenPositionsData, GetPartyAOpenPositionsQueryKey>
>;

/** TanStack Query options returned by {@link getPartyAOpenPositionsQueryOptions}. */
export type GetPartyAOpenPositionsQueryOptions = SymmioQueryOptions<
  GetPartyAOpenPositionsData,
  Error,
  GetPartyAOpenPositionsData,
  GetPartyAOpenPositionsQueryKey
>;

/**
 * Build TanStack Query options for {@link getPartyAOpenPositions}. The query is
 * disabled until `partyA` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPartyAOpenPositionsQueryOptions(config, { partyA, chainId }));
 * ```
 */
export function getPartyAOpenPositionsQueryOptions(
  config: Config,
  options: GetPartyAOpenPositionsOptions = {},
): GetPartyAOpenPositionsQueryOptions {
  return {
    ...options.query,
    queryKey: getPartyAOpenPositionsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.partyA) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, partyA, start, size } = options;
      if (!partyA) {
        throw new SymmError("validation", "MISSING_PARTY_A", "getPartyAOpenPositions: `partyA` is required.");
      }
      return getPartyAOpenPositions(config, { chainId, partyA, start, size });
    },
  };
}
