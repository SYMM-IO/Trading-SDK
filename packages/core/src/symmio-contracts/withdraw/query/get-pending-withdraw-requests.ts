import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPendingWithdrawRequests,
  type GetPendingWithdrawRequestsParameters,
  type GetPendingWithdrawRequestsReturnType,
} from "../actions/get-pending-withdraw-requests";

/** Data resolved by the {@link getPendingWithdrawRequestsQueryOptions} query. */
export type GetPendingWithdrawRequestsData = GetPendingWithdrawRequestsReturnType;

/**
 * Build the TanStack Query key for {@link getPendingWithdrawRequestsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user, pagination).
 * @returns A stable, hashable query key.
 */
export function getPendingWithdrawRequestsQueryKey(
  options: Compute<ExactPartial<GetPendingWithdrawRequestsParameters> & ConfigKeyParameter> = {},
) {
  return ["getPendingWithdrawRequests", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPendingWithdrawRequestsQueryKey}. */
export type GetPendingWithdrawRequestsQueryKey = ReturnType<typeof getPendingWithdrawRequestsQueryKey>;

/**
 * Options accepted by {@link getPendingWithdrawRequestsQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetPendingWithdrawRequestsOptions = Compute<
  ExactPartial<GetPendingWithdrawRequestsParameters> &
    QueryParameter<
      GetPendingWithdrawRequestsData,
      Error,
      GetPendingWithdrawRequestsData,
      GetPendingWithdrawRequestsQueryKey
    >
>;

/** TanStack Query options returned by {@link getPendingWithdrawRequestsQueryOptions}. */
export type GetPendingWithdrawRequestsQueryOptions = SymmioQueryOptions<
  GetPendingWithdrawRequestsData,
  Error,
  GetPendingWithdrawRequestsData,
  GetPendingWithdrawRequestsQueryKey
>;

/**
 * Build TanStack Query options for {@link getPendingWithdrawRequests}. The query
 * is disabled until `user` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getPendingWithdrawRequestsQueryOptions(config, { user, chainId }));
 * ```
 */
export function getPendingWithdrawRequestsQueryOptions(
  config: Config,
  options: GetPendingWithdrawRequestsOptions = {},
): GetPendingWithdrawRequestsQueryOptions {
  return {
    ...options.query,
    queryKey: getPendingWithdrawRequestsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user, start, size } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getPendingWithdrawRequests: `user` is required.");
      }
      return getPendingWithdrawRequests(config, { chainId, user, start, size });
    },
  };
}
