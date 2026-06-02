import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ExactPartial, ScopeKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getUserSubAccounts,
  type GetUserSubAccountsParameters,
  type GetUserSubAccountsReturnType,
} from "../actions/get-user-sub-accounts";

/** Data resolved by the {@link getUserSubAccountsQueryOptions} query. */
export type GetUserSubAccountsData = GetUserSubAccountsReturnType;

/**
 * Build the TanStack Query key for {@link getUserSubAccountsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user, pagination).
 * @returns A stable, hashable query key.
 */
export function getUserSubAccountsQueryKey(
  options: Compute<ExactPartial<GetUserSubAccountsParameters> & ScopeKeyParameter> = {},
) {
  return ["getUserSubAccounts", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserSubAccountsQueryKey}. */
export type GetUserSubAccountsQueryKey = ReturnType<typeof getUserSubAccountsQueryKey>;

/**
 * Options accepted by {@link getUserSubAccountsQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetUserSubAccountsOptions = Compute<
  ExactPartial<GetUserSubAccountsParameters> &
    ScopeKeyParameter &
    QueryParameter<GetUserSubAccountsData, Error, GetUserSubAccountsData, GetUserSubAccountsQueryKey>
>;

/** TanStack Query options returned by {@link getUserSubAccountsQueryOptions}. */
export type GetUserSubAccountsQueryOptions = SymmioQueryOptions<
  GetUserSubAccountsData,
  Error,
  GetUserSubAccountsData,
  GetUserSubAccountsQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserSubAccounts}. The query is
 * disabled until `user` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserSubAccountsQueryOptions(config, { user, chainId }));
 * ```
 */
export function getUserSubAccountsQueryOptions(
  config: Config,
  options: GetUserSubAccountsOptions = {},
): GetUserSubAccountsQueryOptions {
  return {
    ...options.query,
    queryKey: getUserSubAccountsQueryKey(options),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user, offset, limit } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getUserSubAccounts: `user` is required.");
      }
      return getUserSubAccounts(config, { chainId, user, offset, limit });
    },
  };
}
