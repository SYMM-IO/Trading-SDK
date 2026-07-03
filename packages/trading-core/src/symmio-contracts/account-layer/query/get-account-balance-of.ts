import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getAccountBalanceOf,
  type GetAccountBalanceOfParameters,
  type GetAccountBalanceOfReturnType,
} from "../actions/get-account-balance-of";

/** Data resolved by the {@link getAccountBalanceOfQueryOptions} query. */
export type GetAccountBalanceOfData = GetAccountBalanceOfReturnType;

/**
 * Build the TanStack Query key for {@link getAccountBalanceOfQueryOptions}.
 *
 * @param options - Partial query parameters (chain id and account).
 * @returns A stable, hashable query key.
 */
export function getAccountBalanceOfQueryKey(
  options: Compute<ExactPartial<GetAccountBalanceOfParameters> & ConfigKeyParameter> = {},
) {
  return ["getAccountBalanceOf", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getAccountBalanceOfQueryKey}. */
export type GetAccountBalanceOfQueryKey = ReturnType<typeof getAccountBalanceOfQueryKey>;

/**
 * Options accepted by {@link getAccountBalanceOfQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetAccountBalanceOfOptions = Compute<
  ExactPartial<GetAccountBalanceOfParameters> &
    QueryParameter<GetAccountBalanceOfData, Error, GetAccountBalanceOfData, GetAccountBalanceOfQueryKey>
>;

/** TanStack Query options returned by {@link getAccountBalanceOfQueryOptions}. */
export type GetAccountBalanceOfQueryOptions = SymmioQueryOptions<
  GetAccountBalanceOfData,
  Error,
  GetAccountBalanceOfData,
  GetAccountBalanceOfQueryKey
>;

/**
 * Build TanStack Query options for {@link getAccountBalanceOf}. The query is
 * disabled until `account` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getAccountBalanceOfQueryOptions(config, { account, chainId }));
 * ```
 */
export function getAccountBalanceOfQueryOptions(
  config: Config,
  options: GetAccountBalanceOfOptions = {},
): GetAccountBalanceOfQueryOptions {
  return {
    ...options.query,
    queryKey: getAccountBalanceOfQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.account) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account } = options;
      if (!account) {
        throw new SymmError("validation", "MISSING_ACCOUNT", "getAccountBalanceOf: `account` is required.");
      }
      return getAccountBalanceOf(config, { chainId, account });
    },
  };
}
