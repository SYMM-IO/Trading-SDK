import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getWithdrawableTime,
  type GetWithdrawableTimeParameters,
  type GetWithdrawableTimeReturnType,
} from "../actions/get-withdrawable-time";

/** Data resolved by the {@link getWithdrawableTimeQueryOptions} query. */
export type GetWithdrawableTimeData = GetWithdrawableTimeReturnType;

/**
 * Build the TanStack Query key for {@link getWithdrawableTimeQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, user).
 * @returns A stable, hashable query key.
 */
export function getWithdrawableTimeQueryKey(
  options: Compute<ExactPartial<GetWithdrawableTimeParameters> & ConfigKeyParameter> = {},
) {
  return ["getWithdrawableTime", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getWithdrawableTimeQueryKey}. */
export type GetWithdrawableTimeQueryKey = ReturnType<typeof getWithdrawableTimeQueryKey>;

/**
 * Options accepted by {@link getWithdrawableTimeQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetWithdrawableTimeOptions = Compute<
  ExactPartial<GetWithdrawableTimeParameters> &
    QueryParameter<GetWithdrawableTimeData, Error, GetWithdrawableTimeData, GetWithdrawableTimeQueryKey>
>;

/** TanStack Query options returned by {@link getWithdrawableTimeQueryOptions}. */
export type GetWithdrawableTimeQueryOptions = SymmioQueryOptions<
  GetWithdrawableTimeData,
  Error,
  GetWithdrawableTimeData,
  GetWithdrawableTimeQueryKey
>;

/**
 * Build TanStack Query options for {@link getWithdrawableTime}. The query is
 * disabled until `user` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getWithdrawableTimeQueryOptions(config, { user, chainId }));
 * ```
 */
export function getWithdrawableTimeQueryOptions(
  config: Config,
  options: GetWithdrawableTimeOptions = {},
): GetWithdrawableTimeQueryOptions {
  return {
    ...options.query,
    queryKey: getWithdrawableTimeQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.user) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user } = options;
      if (!user) {
        throw new SymmError("validation", "MISSING_USER", "getWithdrawableTime: `user` is required.");
      }
      return getWithdrawableTime(config, { chainId, user });
    },
  };
}
