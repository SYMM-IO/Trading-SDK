import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getVirtualAccountsOfSubAccount,
  type GetVirtualAccountsOfSubAccountParameters,
  type GetVirtualAccountsOfSubAccountReturnType,
} from "../actions/get-virtual-accounts-of-sub-account";

/** Data resolved by the {@link getVirtualAccountsOfSubAccountQueryOptions} query. */
export type GetVirtualAccountsOfSubAccountData = GetVirtualAccountsOfSubAccountReturnType;

/**
 * Build the TanStack Query key for {@link getVirtualAccountsOfSubAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount, pagination).
 * @returns A stable, hashable query key.
 */
export function getVirtualAccountsOfSubAccountQueryKey(
  options: Compute<ExactPartial<GetVirtualAccountsOfSubAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getVirtualAccountsOfSubAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getVirtualAccountsOfSubAccountQueryKey}. */
export type GetVirtualAccountsOfSubAccountQueryKey = ReturnType<typeof getVirtualAccountsOfSubAccountQueryKey>;

/**
 * Options accepted by {@link getVirtualAccountsOfSubAccountQueryOptions}:
 * the action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GetVirtualAccountsOfSubAccountOptions = Compute<
  ExactPartial<GetVirtualAccountsOfSubAccountParameters> &
    QueryParameter<
      GetVirtualAccountsOfSubAccountData,
      Error,
      GetVirtualAccountsOfSubAccountData,
      GetVirtualAccountsOfSubAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getVirtualAccountsOfSubAccountQueryOptions}. */
export type GetVirtualAccountsOfSubAccountQueryOptions = SymmioQueryOptions<
  GetVirtualAccountsOfSubAccountData,
  Error,
  GetVirtualAccountsOfSubAccountData,
  GetVirtualAccountsOfSubAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getVirtualAccountsOfSubAccount}.
 * The query is disabled until `subAccount` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getVirtualAccountsOfSubAccountQueryOptions(config, { subAccount, chainId }));
 * ```
 */
export function getVirtualAccountsOfSubAccountQueryOptions(
  config: Config,
  options: GetVirtualAccountsOfSubAccountOptions = {},
): GetVirtualAccountsOfSubAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getVirtualAccountsOfSubAccountQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.subAccount) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, subAccount, offset, limit } = options;
      if (!subAccount) {
        throw new SymmError(
          "validation",
          "MISSING_SUB_ACCOUNT",
          "getVirtualAccountsOfSubAccount: `subAccount` is required.",
        );
      }
      return getVirtualAccountsOfSubAccount(config, { chainId, subAccount, offset, limit });
    },
  };
}
