import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getActiveDelegations,
  type GetActiveDelegationsParameters,
  type GetActiveDelegationsReturnType,
} from "../actions/get-active-delegations";

/** Data resolved by the {@link getActiveDelegationsQueryOptions} query. */
export type GetActiveDelegationsData = GetActiveDelegationsReturnType;

/**
 * Build the TanStack Query key for {@link getActiveDelegationsQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getActiveDelegationsQueryKey(
  options: Compute<ExactPartial<GetActiveDelegationsParameters> & ConfigKeyParameter> = {},
) {
  return ["getActiveDelegations", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getActiveDelegationsQueryKey}. */
export type GetActiveDelegationsQueryKey = ReturnType<typeof getActiveDelegationsQueryKey>;

/**
 * Options accepted by {@link getActiveDelegationsQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetActiveDelegationsOptions = Compute<
  GetActiveDelegationsParameters &
    QueryParameter<GetActiveDelegationsData, Error, GetActiveDelegationsData, GetActiveDelegationsQueryKey>
>;

/** TanStack Query options returned by {@link getActiveDelegationsQueryOptions}. */
export type GetActiveDelegationsQueryOptions = SymmioQueryOptions<
  GetActiveDelegationsData,
  Error,
  GetActiveDelegationsData,
  GetActiveDelegationsQueryKey
>;

/**
 * Build TanStack Query options for {@link getActiveDelegations}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getActiveDelegationsQueryOptions(config, { delegator, delegates, selectors }));
 * ```
 */
export function getActiveDelegationsQueryOptions(
  config: Config,
  options: GetActiveDelegationsOptions,
): GetActiveDelegationsQueryOptions {
  return {
    ...options.query,
    queryKey: getActiveDelegationsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, delegator, delegates, selectors } = options;
      return getActiveDelegations(config, { chainId, delegator, delegates, selectors });
    },
  };
}
