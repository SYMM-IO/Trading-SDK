import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getDelegationExpiry,
  type GetDelegationExpiryParameters,
  type GetDelegationExpiryReturnType,
} from "../actions/get-delegation-expiry";

/** Data resolved by the {@link getDelegationExpiryQueryOptions} query. */
export type GetDelegationExpiryData = GetDelegationExpiryReturnType;

/**
 * Build the TanStack Query key for {@link getDelegationExpiryQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getDelegationExpiryQueryKey(
  options: Compute<ExactPartial<GetDelegationExpiryParameters> & ConfigKeyParameter> = {},
) {
  return ["getDelegationExpiry", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getDelegationExpiryQueryKey}. */
export type GetDelegationExpiryQueryKey = ReturnType<typeof getDelegationExpiryQueryKey>;

/**
 * Options accepted by {@link getDelegationExpiryQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetDelegationExpiryOptions = Compute<
  GetDelegationExpiryParameters &
    QueryParameter<GetDelegationExpiryData, Error, GetDelegationExpiryData, GetDelegationExpiryQueryKey>
>;

/** TanStack Query options returned by {@link getDelegationExpiryQueryOptions}. */
export type GetDelegationExpiryQueryOptions = SymmioQueryOptions<
  GetDelegationExpiryData,
  Error,
  GetDelegationExpiryData,
  GetDelegationExpiryQueryKey
>;

/**
 * Build TanStack Query options for {@link getDelegationExpiry}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getDelegationExpiryQueryOptions(config, { account, delegate, selector }));
 * ```
 */
export function getDelegationExpiryQueryOptions(
  config: Config,
  options: GetDelegationExpiryOptions,
): GetDelegationExpiryQueryOptions {
  return {
    ...options.query,
    queryKey: getDelegationExpiryQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, account, delegate, selector } = options;
      return getDelegationExpiry(config, { chainId, account, delegate, selector });
    },
  };
}
