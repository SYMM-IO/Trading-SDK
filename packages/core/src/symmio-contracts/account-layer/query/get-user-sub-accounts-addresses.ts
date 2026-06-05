import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getUserSubAccountsAddresses,
  type GetUserSubAccountsAddressesParameters,
  type GetUserSubAccountsAddressesReturnType,
} from "../actions/get-user-sub-accounts-addresses";

/** Data resolved by the {@link getUserSubAccountsAddressesQueryOptions} query. */
export type GetUserSubAccountsAddressesData = GetUserSubAccountsAddressesReturnType;

/**
 * Build the TanStack Query key for {@link getUserSubAccountsAddressesQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user, pagination).
 * @returns A stable, hashable query key.
 */
export function getUserSubAccountsAddressesQueryKey(
  options: Compute<ExactPartial<GetUserSubAccountsAddressesParameters> & ConfigKeyParameter> = {},
) {
  return ["getUserSubAccountsAddresses", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserSubAccountsAddressesQueryKey}. */
export type GetUserSubAccountsAddressesQueryKey = ReturnType<typeof getUserSubAccountsAddressesQueryKey>;

/**
 * Options accepted by {@link getUserSubAccountsAddressesQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetUserSubAccountsAddressesOptions = Compute<
  ExactPartial<GetUserSubAccountsAddressesParameters> &
    QueryParameter<
      GetUserSubAccountsAddressesData,
      Error,
      GetUserSubAccountsAddressesData,
      GetUserSubAccountsAddressesQueryKey
    >
>;

/** TanStack Query options returned by {@link getUserSubAccountsAddressesQueryOptions}. */
export type GetUserSubAccountsAddressesQueryOptions = SymmioQueryOptions<
  GetUserSubAccountsAddressesData,
  Error,
  GetUserSubAccountsAddressesData,
  GetUserSubAccountsAddressesQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserSubAccountsAddresses}. The query
 * is disabled until `user` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserSubAccountsAddressesQueryOptions(config, { user, chainId }));
 * ```
 */
export function getUserSubAccountsAddressesQueryOptions(
  config: Config,
  options: GetUserSubAccountsAddressesOptions = {},
): GetUserSubAccountsAddressesQueryOptions {
  return {
    ...options.query,
    queryKey: getUserSubAccountsAddressesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user, offset, limit } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getUserSubAccountsAddresses: `user` is required.");
      }
      return getUserSubAccountsAddresses(config, { chainId, user, offset, limit });
    },
  };
}
