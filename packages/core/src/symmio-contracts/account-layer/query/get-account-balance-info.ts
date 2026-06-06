import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getAccountBalanceInfo,
  type GetAccountBalanceInfoParameters,
  type GetAccountBalanceInfoReturnType,
} from "../actions/get-account-balance-info";

/** Data resolved by the {@link getAccountBalanceInfoQueryOptions} query. */
export type GetAccountBalanceInfoData = GetAccountBalanceInfoReturnType;

/**
 * Build the TanStack Query key for {@link getAccountBalanceInfoQueryOptions}.
 *
 * @param options - Partial query parameters (chain id and account).
 * @returns A stable, hashable query key.
 */
export function getAccountBalanceInfoQueryKey(
  options: Compute<ExactPartial<GetAccountBalanceInfoParameters> & ConfigKeyParameter> = {},
) {
  return ["getAccountBalanceInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getAccountBalanceInfoQueryKey}. */
export type GetAccountBalanceInfoQueryKey = ReturnType<typeof getAccountBalanceInfoQueryKey>;

/**
 * Options accepted by {@link getAccountBalanceInfoQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetAccountBalanceInfoOptions = Compute<
  ExactPartial<GetAccountBalanceInfoParameters> &
    QueryParameter<GetAccountBalanceInfoData, Error, GetAccountBalanceInfoData, GetAccountBalanceInfoQueryKey>
>;

/** TanStack Query options returned by {@link getAccountBalanceInfoQueryOptions}. */
export type GetAccountBalanceInfoQueryOptions = SymmioQueryOptions<
  GetAccountBalanceInfoData,
  Error,
  GetAccountBalanceInfoData,
  GetAccountBalanceInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getAccountBalanceInfo}. The query
 * is disabled until `account` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getAccountBalanceInfoQueryOptions(config, { account, chainId }));
 * ```
 */
export function getAccountBalanceInfoQueryOptions(
  config: Config,
  options: GetAccountBalanceInfoOptions = {},
): GetAccountBalanceInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getAccountBalanceInfoQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.account) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account } = options;
      if (!account) {
        throw new SymmError("validation", "MISSING_ACCOUNT", "getAccountBalanceInfo: `account` is required.");
      }
      return getAccountBalanceInfo(config, { chainId, account });
    },
  };
}
