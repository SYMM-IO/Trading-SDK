import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import { getFeeForUser, type GetFeeForUserParameters, type GetFeeForUserReturnType } from "../actions/get-fee-for-user";

/** Data resolved by the {@link getFeeForUserQueryOptions} query. */
export type GetFeeForUserData = GetFeeForUserReturnType;

/**
 * Build the TanStack Query key for {@link getFeeForUserQueryOptions}.
 *
 * @param options - Query parameters (chain id, affiliate, user, symbol id).
 * @returns A stable, hashable query key.
 */
export function getFeeForUserQueryKey(options: Compute<GetFeeForUserParameters & ConfigKeyParameter>) {
  return ["getFeeForUser", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getFeeForUserQueryKey}. */
export type GetFeeForUserQueryKey = ReturnType<typeof getFeeForUserQueryKey>;

/**
 * Options accepted by {@link getFeeForUserQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetFeeForUserOptions = Compute<
  GetFeeForUserParameters & QueryParameter<GetFeeForUserData, Error, GetFeeForUserData, GetFeeForUserQueryKey>
>;

/** TanStack Query options returned by {@link getFeeForUserQueryOptions}. */
export type GetFeeForUserQueryOptions = SymmioQueryOptions<
  GetFeeForUserData,
  Error,
  GetFeeForUserData,
  GetFeeForUserQueryKey
>;

/**
 * Build TanStack Query options for {@link getFeeForUser}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getFeeForUserQueryOptions(config, { user, symbolId: 1n }));
 * ```
 */
export function getFeeForUserQueryOptions(config: Config, options: GetFeeForUserOptions): GetFeeForUserQueryOptions {
  return {
    ...options.query,
    queryKey: getFeeForUserQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getFeeForUser(config, {
        chainId: options.chainId,
        affiliate: options.affiliate,
        user: options.user,
        symbolId: options.symbolId,
      }),
  };
}
