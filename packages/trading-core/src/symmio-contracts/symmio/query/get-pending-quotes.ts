import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPendingQuotes,
  type GetPendingQuotesParameters,
  type GetPendingQuotesReturnType,
} from "../actions/get-pending-quotes";

/** Data resolved by the {@link getPendingQuotesQueryOptions} query. */
export type GetPendingQuotesData = GetPendingQuotesReturnType;

/**
 * Build the TanStack Query key for {@link getPendingQuotesQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, partyA, batch size).
 * @returns A stable, hashable query key.
 */
export function getPendingQuotesQueryKey(
  options: Compute<ExactPartial<GetPendingQuotesParameters> & ConfigKeyParameter> = {},
) {
  return ["getPendingQuotes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPendingQuotesQueryKey}. */
export type GetPendingQuotesQueryKey = ReturnType<typeof getPendingQuotesQueryKey>;

/**
 * Options accepted by {@link getPendingQuotesQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetPendingQuotesOptions = Compute<
  ExactPartial<GetPendingQuotesParameters> &
    QueryParameter<GetPendingQuotesData, Error, GetPendingQuotesData, GetPendingQuotesQueryKey>
>;

/** TanStack Query options returned by {@link getPendingQuotesQueryOptions}. */
export type GetPendingQuotesQueryOptions = SymmioQueryOptions<
  GetPendingQuotesData,
  Error,
  GetPendingQuotesData,
  GetPendingQuotesQueryKey
>;

/**
 * Build TanStack Query options for {@link getPendingQuotes}. Disabled until
 * `partyA` is set; an unsupported chain surfaces a {@link SymmError} from the
 * query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPendingQuotesQueryOptions(config, { partyA, chainId }));
 * ```
 */
export function getPendingQuotesQueryOptions(
  config: Config,
  options: GetPendingQuotesOptions = {},
): GetPendingQuotesQueryOptions {
  return {
    ...options.query,
    queryKey: getPendingQuotesQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.partyA) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, partyA, batchSize } = options;
      if (!partyA) {
        throw new SymmError("validation", "MISSING_PARTY_A", "getPendingQuotes: `partyA` is required.");
      }
      return getPendingQuotes(config, { chainId, partyA, batchSize });
    },
  };
}
