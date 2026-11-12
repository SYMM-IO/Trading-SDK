import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getVirtualAccountsCountOfSubAccount,
  type GetVirtualAccountsCountOfSubAccountParameters,
  type GetVirtualAccountsCountOfSubAccountReturnType,
} from "../actions/get-virtual-accounts-count-of-sub-account";

/** Data resolved by the {@link getVirtualAccountsCountOfSubAccountQueryOptions} query. */
export type GetVirtualAccountsCountOfSubAccountData = GetVirtualAccountsCountOfSubAccountReturnType;

/**
 * Build the TanStack Query key for {@link getVirtualAccountsCountOfSubAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount).
 * @returns A stable, hashable query key.
 */
export function getVirtualAccountsCountOfSubAccountQueryKey(
  options: Compute<ExactPartial<GetVirtualAccountsCountOfSubAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getVirtualAccountsCountOfSubAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getVirtualAccountsCountOfSubAccountQueryKey}. */
export type GetVirtualAccountsCountOfSubAccountQueryKey = ReturnType<
  typeof getVirtualAccountsCountOfSubAccountQueryKey
>;

/**
 * Options accepted by {@link getVirtualAccountsCountOfSubAccountQueryOptions}:
 * the action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GetVirtualAccountsCountOfSubAccountOptions = Compute<
  ExactPartial<GetVirtualAccountsCountOfSubAccountParameters> &
    QueryParameter<
      GetVirtualAccountsCountOfSubAccountData,
      Error,
      GetVirtualAccountsCountOfSubAccountData,
      GetVirtualAccountsCountOfSubAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getVirtualAccountsCountOfSubAccountQueryOptions}. */
export type GetVirtualAccountsCountOfSubAccountQueryOptions = SymmioQueryOptions<
  GetVirtualAccountsCountOfSubAccountData,
  Error,
  GetVirtualAccountsCountOfSubAccountData,
  GetVirtualAccountsCountOfSubAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getVirtualAccountsCountOfSubAccount}.
 * The query is disabled until `subAccount` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getVirtualAccountsCountOfSubAccountQueryOptions(config, { subAccount, chainId }));
 * ```
 */
export function getVirtualAccountsCountOfSubAccountQueryOptions(
  config: Config,
  options: GetVirtualAccountsCountOfSubAccountOptions = {},
): GetVirtualAccountsCountOfSubAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getVirtualAccountsCountOfSubAccountQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.subAccount) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, subAccount } = options;
      if (!subAccount) {
        throw new SymmError(
          "validation",
          "MISSING_SUB_ACCOUNT",
          "getVirtualAccountsCountOfSubAccount: `subAccount` is required.",
        );
      }
      return getVirtualAccountsCountOfSubAccount(config, { chainId, subAccount });
    },
  };
}
