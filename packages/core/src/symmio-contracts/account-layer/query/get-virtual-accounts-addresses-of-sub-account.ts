import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getVirtualAccountsAddressesOfSubAccount,
  type GetVirtualAccountsAddressesOfSubAccountParameters,
  type GetVirtualAccountsAddressesOfSubAccountReturnType,
} from "../actions/get-virtual-accounts-addresses-of-sub-account";

/** Data resolved by the {@link getVirtualAccountsAddressesOfSubAccountQueryOptions} query. */
export type GetVirtualAccountsAddressesOfSubAccountData = GetVirtualAccountsAddressesOfSubAccountReturnType;

/**
 * Build the TanStack Query key for {@link getVirtualAccountsAddressesOfSubAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount, pagination).
 * @returns A stable, hashable query key.
 */
export function getVirtualAccountsAddressesOfSubAccountQueryKey(
  options: Compute<ExactPartial<GetVirtualAccountsAddressesOfSubAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getVirtualAccountsAddressesOfSubAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getVirtualAccountsAddressesOfSubAccountQueryKey}. */
export type GetVirtualAccountsAddressesOfSubAccountQueryKey = ReturnType<
  typeof getVirtualAccountsAddressesOfSubAccountQueryKey
>;

/**
 * Options accepted by {@link getVirtualAccountsAddressesOfSubAccountQueryOptions}:
 * the action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GetVirtualAccountsAddressesOfSubAccountOptions = Compute<
  ExactPartial<GetVirtualAccountsAddressesOfSubAccountParameters> &
    QueryParameter<
      GetVirtualAccountsAddressesOfSubAccountData,
      Error,
      GetVirtualAccountsAddressesOfSubAccountData,
      GetVirtualAccountsAddressesOfSubAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getVirtualAccountsAddressesOfSubAccountQueryOptions}. */
export type GetVirtualAccountsAddressesOfSubAccountQueryOptions = SymmioQueryOptions<
  GetVirtualAccountsAddressesOfSubAccountData,
  Error,
  GetVirtualAccountsAddressesOfSubAccountData,
  GetVirtualAccountsAddressesOfSubAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getVirtualAccountsAddressesOfSubAccount}.
 * The query is disabled until `subAccount` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getVirtualAccountsAddressesOfSubAccountQueryOptions(config, { subAccount, chainId }));
 * ```
 */
export function getVirtualAccountsAddressesOfSubAccountQueryOptions(
  config: Config,
  options: GetVirtualAccountsAddressesOfSubAccountOptions = {},
): GetVirtualAccountsAddressesOfSubAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getVirtualAccountsAddressesOfSubAccountQueryKey({
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
          "getVirtualAccountsAddressesOfSubAccount: `subAccount` is required.",
        );
      }
      return getVirtualAccountsAddressesOfSubAccount(config, { chainId, subAccount, offset, limit });
    },
  };
}
