import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getLastWithdrawRequestId,
  type GetLastWithdrawRequestIdParameters,
  type GetLastWithdrawRequestIdReturnType,
} from "../actions/get-last-withdraw-request-id";

/** Data resolved by the {@link getLastWithdrawRequestIdQueryOptions} query. */
export type GetLastWithdrawRequestIdData = GetLastWithdrawRequestIdReturnType;

/**
 * Build the TanStack Query key for {@link getLastWithdrawRequestIdQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user).
 * @returns A stable, hashable query key.
 */
export function getLastWithdrawRequestIdQueryKey(
  options: Compute<ExactPartial<GetLastWithdrawRequestIdParameters> & ConfigKeyParameter> = {},
) {
  return ["getLastWithdrawRequestId", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getLastWithdrawRequestIdQueryKey}. */
export type GetLastWithdrawRequestIdQueryKey = ReturnType<typeof getLastWithdrawRequestIdQueryKey>;

/**
 * Options accepted by {@link getLastWithdrawRequestIdQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetLastWithdrawRequestIdOptions = Compute<
  ExactPartial<GetLastWithdrawRequestIdParameters> &
    QueryParameter<GetLastWithdrawRequestIdData, Error, GetLastWithdrawRequestIdData, GetLastWithdrawRequestIdQueryKey>
>;

/** TanStack Query options returned by {@link getLastWithdrawRequestIdQueryOptions}. */
export type GetLastWithdrawRequestIdQueryOptions = SymmioQueryOptions<
  GetLastWithdrawRequestIdData,
  Error,
  GetLastWithdrawRequestIdData,
  GetLastWithdrawRequestIdQueryKey
>;

/**
 * Build TanStack Query options for {@link getLastWithdrawRequestId}. The query is
 * disabled until `user` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getLastWithdrawRequestIdQueryOptions(config, { user, chainId }));
 * ```
 */
export function getLastWithdrawRequestIdQueryOptions(
  config: Config,
  options: GetLastWithdrawRequestIdOptions = {},
): GetLastWithdrawRequestIdQueryOptions {
  return {
    ...options.query,
    queryKey: getLastWithdrawRequestIdQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getLastWithdrawRequestId: `user` is required.");
      }
      return getLastWithdrawRequestId(config, { chainId, user });
    },
  };
}
