import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getIsDelegationActive,
  type GetIsDelegationActiveParameters,
  type GetIsDelegationActiveReturnType,
} from "../actions/get-is-delegation-active";

/** Data resolved by the {@link getIsDelegationActiveQueryOptions} query. */
export type GetIsDelegationActiveData = GetIsDelegationActiveReturnType;

/**
 * Build the TanStack Query key for {@link getIsDelegationActiveQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getIsDelegationActiveQueryKey(
  options: Compute<ExactPartial<GetIsDelegationActiveParameters> & ConfigKeyParameter> = {},
) {
  return ["getIsDelegationActive", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getIsDelegationActiveQueryKey}. */
export type GetIsDelegationActiveQueryKey = ReturnType<typeof getIsDelegationActiveQueryKey>;

/**
 * Options accepted by {@link getIsDelegationActiveQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetIsDelegationActiveOptions = Compute<
  GetIsDelegationActiveParameters &
    QueryParameter<GetIsDelegationActiveData, Error, GetIsDelegationActiveData, GetIsDelegationActiveQueryKey>
>;

/** TanStack Query options returned by {@link getIsDelegationActiveQueryOptions}. */
export type GetIsDelegationActiveQueryOptions = SymmioQueryOptions<
  GetIsDelegationActiveData,
  Error,
  GetIsDelegationActiveData,
  GetIsDelegationActiveQueryKey
>;

/**
 * Build TanStack Query options for {@link getIsDelegationActive}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getIsDelegationActiveQueryOptions(config, { account, delegate, selector }));
 * ```
 */
export function getIsDelegationActiveQueryOptions(
  config: Config,
  options: GetIsDelegationActiveOptions,
): GetIsDelegationActiveQueryOptions {
  return {
    ...options.query,
    queryKey: getIsDelegationActiveQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, account, delegate, selector } = options;
      return getIsDelegationActive(config, { chainId, account, delegate, selector });
    },
  };
}
