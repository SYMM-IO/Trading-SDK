import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getWithdrawRequests,
  type GetWithdrawRequestsParameters,
  type GetWithdrawRequestsReturnType,
} from "../actions/get-withdraw-requests";

/** Data resolved by the {@link getWithdrawRequestsQueryOptions} query. */
export type GetWithdrawRequestsData = GetWithdrawRequestsReturnType;

/**
 * Build the TanStack Query key for {@link getWithdrawRequestsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user, request id).
 * @returns A stable, hashable query key.
 */
export function getWithdrawRequestsQueryKey(
  options: Compute<ExactPartial<GetWithdrawRequestsParameters> & ConfigKeyParameter> = {},
) {
  return ["getWithdrawRequests", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getWithdrawRequestsQueryKey}. */
export type GetWithdrawRequestsQueryKey = ReturnType<typeof getWithdrawRequestsQueryKey>;

/**
 * Options accepted by {@link getWithdrawRequestsQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetWithdrawRequestsOptions = Compute<
  ExactPartial<GetWithdrawRequestsParameters> &
    QueryParameter<GetWithdrawRequestsData, Error, GetWithdrawRequestsData, GetWithdrawRequestsQueryKey>
>;

/** TanStack Query options returned by {@link getWithdrawRequestsQueryOptions}. */
export type GetWithdrawRequestsQueryOptions = SymmioQueryOptions<
  GetWithdrawRequestsData,
  Error,
  GetWithdrawRequestsData,
  GetWithdrawRequestsQueryKey
>;

/**
 * Build TanStack Query options for {@link getWithdrawRequests}. The query is
 * disabled until both `user` and `requestId` are set. An unsupported chain
 * surfaces a {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getWithdrawRequestsQueryOptions(config, { user, requestId, chainId }));
 * ```
 */
export function getWithdrawRequestsQueryOptions(
  config: Config,
  options: GetWithdrawRequestsOptions = {},
): GetWithdrawRequestsQueryOptions {
  return {
    ...options.query,
    queryKey: getWithdrawRequestsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.user) && options.requestId !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user, requestId } = options;
      if (!user || requestId === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_PARAMS",
          "getWithdrawRequests: `user` and `requestId` are required.",
        );
      }
      return getWithdrawRequests(config, { chainId, user, requestId });
    },
  };
}
