import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPartyAPendingQuotes,
  type GetPartyAPendingQuotesParameters,
  type GetPartyAPendingQuotesReturnType,
} from "../actions/get-party-a-pending-quotes";

/** Data resolved by the {@link getPartyAPendingQuotesQueryOptions} query. */
export type GetPartyAPendingQuotesData = GetPartyAPendingQuotesReturnType;

/**
 * Build the TanStack Query key for {@link getPartyAPendingQuotesQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, partyA).
 * @returns A stable, hashable query key.
 */
export function getPartyAPendingQuotesQueryKey(
  options: Compute<ExactPartial<GetPartyAPendingQuotesParameters> & ConfigKeyParameter> = {},
) {
  return ["getPartyAPendingQuotes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPartyAPendingQuotesQueryKey}. */
export type GetPartyAPendingQuotesQueryKey = ReturnType<typeof getPartyAPendingQuotesQueryKey>;

/**
 * Options accepted by {@link getPartyAPendingQuotesQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetPartyAPendingQuotesOptions = Compute<
  ExactPartial<GetPartyAPendingQuotesParameters> &
    QueryParameter<GetPartyAPendingQuotesData, Error, GetPartyAPendingQuotesData, GetPartyAPendingQuotesQueryKey>
>;

/** TanStack Query options returned by {@link getPartyAPendingQuotesQueryOptions}. */
export type GetPartyAPendingQuotesQueryOptions = SymmioQueryOptions<
  GetPartyAPendingQuotesData,
  Error,
  GetPartyAPendingQuotesData,
  GetPartyAPendingQuotesQueryKey
>;

/**
 * Build TanStack Query options for {@link getPartyAPendingQuotes}. The query is
 * disabled until `partyA` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPartyAPendingQuotesQueryOptions(config, { partyA, chainId }));
 * ```
 */
export function getPartyAPendingQuotesQueryOptions(
  config: Config,
  options: GetPartyAPendingQuotesOptions = {},
): GetPartyAPendingQuotesQueryOptions {
  return {
    ...options.query,
    queryKey: getPartyAPendingQuotesQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.partyA) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, partyA } = options;
      if (!partyA) {
        throw new SymmError("validation", "MISSING_PARTY_A", "getPartyAPendingQuotes: `partyA` is required.");
      }
      return getPartyAPendingQuotes(config, { chainId, partyA });
    },
  };
}
