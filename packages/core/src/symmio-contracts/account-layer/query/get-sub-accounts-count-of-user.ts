import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getSubAccountsCountOfUser,
  type GetSubAccountsCountOfUserParameters,
  type GetSubAccountsCountOfUserReturnType,
} from "../actions/get-sub-accounts-count-of-user";

/** Data resolved by the {@link getSubAccountsCountOfUserQueryOptions} query. */
export type GetSubAccountsCountOfUserData = GetSubAccountsCountOfUserReturnType;

/**
 * Build the TanStack Query key for {@link getSubAccountsCountOfUserQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user).
 * @returns A stable, hashable query key.
 */
export function getSubAccountsCountOfUserQueryKey(
  options: Compute<ExactPartial<GetSubAccountsCountOfUserParameters> & ConfigKeyParameter> = {},
) {
  return ["getSubAccountsCountOfUser", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSubAccountsCountOfUserQueryKey}. */
export type GetSubAccountsCountOfUserQueryKey = ReturnType<typeof getSubAccountsCountOfUserQueryKey>;

/**
 * Options accepted by {@link getSubAccountsCountOfUserQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetSubAccountsCountOfUserOptions = Compute<
  ExactPartial<GetSubAccountsCountOfUserParameters> &
    QueryParameter<
      GetSubAccountsCountOfUserData,
      Error,
      GetSubAccountsCountOfUserData,
      GetSubAccountsCountOfUserQueryKey
    >
>;

/** TanStack Query options returned by {@link getSubAccountsCountOfUserQueryOptions}. */
export type GetSubAccountsCountOfUserQueryOptions = SymmioQueryOptions<
  GetSubAccountsCountOfUserData,
  Error,
  GetSubAccountsCountOfUserData,
  GetSubAccountsCountOfUserQueryKey
>;

/**
 * Build TanStack Query options for {@link getSubAccountsCountOfUser}. The query is
 * disabled until `user` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSubAccountsCountOfUserQueryOptions(config, { user, chainId }));
 * ```
 */
export function getSubAccountsCountOfUserQueryOptions(
  config: Config,
  options: GetSubAccountsCountOfUserOptions = {},
): GetSubAccountsCountOfUserQueryOptions {
  return {
    ...options.query,
    queryKey: getSubAccountsCountOfUserQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getSubAccountsCountOfUser: `user` is required.");
      }
      return getSubAccountsCountOfUser(config, { chainId, user });
    },
  };
}
