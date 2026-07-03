import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import { getSubAccount, type GetSubAccountParameters, type GetSubAccountReturnType } from "../actions/get-sub-account";

/** Data resolved by the {@link getSubAccountQueryOptions} query. */
export type GetSubAccountData = GetSubAccountReturnType;

/**
 * Build the TanStack Query key for {@link getSubAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, account).
 * @returns A stable, hashable query key.
 */
export function getSubAccountQueryKey(
  options: Compute<ExactPartial<GetSubAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getSubAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSubAccountQueryKey}. */
export type GetSubAccountQueryKey = ReturnType<typeof getSubAccountQueryKey>;

/**
 * Options accepted by {@link getSubAccountQueryOptions}: the action's parameters
 * (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetSubAccountOptions = Compute<
  ExactPartial<GetSubAccountParameters> &
    QueryParameter<GetSubAccountData, Error, GetSubAccountData, GetSubAccountQueryKey>
>;

/** TanStack Query options returned by {@link getSubAccountQueryOptions}. */
export type GetSubAccountQueryOptions = SymmioQueryOptions<
  GetSubAccountData,
  Error,
  GetSubAccountData,
  GetSubAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getSubAccount}. The query is disabled
 * until `account` is set. An unsupported chain surfaces a {@link SymmError} from
 * the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSubAccountQueryOptions(config, { account, chainId }));
 * ```
 */
export function getSubAccountQueryOptions(
  config: Config,
  options: GetSubAccountOptions = {},
): GetSubAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getSubAccountQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.account) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account } = options;
      if (!account) {
        throw new SymmError("validation", "MISSING_ACCOUNT", "getSubAccount: `account` is required.");
      }
      return getSubAccount(config, { chainId, account });
    },
  };
}
