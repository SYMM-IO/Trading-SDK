import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getAffiliateState,
  type GetAffiliateStateParameters,
  type GetAffiliateStateReturnType,
} from "../actions/get-affiliate-state";

/** Data resolved by the {@link getAffiliateStateQueryOptions} query. */
export type GetAffiliateStateData = GetAffiliateStateReturnType;

/**
 * Build the TanStack Query key for {@link getAffiliateStateQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, affiliate).
 * @returns A stable, hashable query key.
 */
export function getAffiliateStateQueryKey(
  options: Compute<ExactPartial<GetAffiliateStateParameters> & ConfigKeyParameter> = {},
) {
  return ["getAffiliateState", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getAffiliateStateQueryKey}. */
export type GetAffiliateStateQueryKey = ReturnType<typeof getAffiliateStateQueryKey>;

/**
 * Options accepted by {@link getAffiliateStateQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetAffiliateStateOptions = Compute<
  ExactPartial<GetAffiliateStateParameters> &
    QueryParameter<GetAffiliateStateData, Error, GetAffiliateStateData, GetAffiliateStateQueryKey>
>;

/** TanStack Query options returned by {@link getAffiliateStateQueryOptions}. */
export type GetAffiliateStateQueryOptions = SymmioQueryOptions<
  GetAffiliateStateData,
  Error,
  GetAffiliateStateData,
  GetAffiliateStateQueryKey
>;

/**
 * Build TanStack Query options for {@link getAffiliateState}. The query is
 * disabled until `affiliate` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getAffiliateStateQueryOptions(config, { affiliate, chainId }));
 * ```
 */
export function getAffiliateStateQueryOptions(
  config: Config,
  options: GetAffiliateStateOptions = {},
): GetAffiliateStateQueryOptions {
  return {
    ...options.query,
    queryKey: getAffiliateStateQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.affiliate) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, affiliate } = options;
      if (!affiliate) {
        throw new SymmError("validation", "MISSING_AFFILIATE", "getAffiliateState: `affiliate` is required.");
      }
      return getAffiliateState(config, { chainId, affiliate });
    },
  };
}
