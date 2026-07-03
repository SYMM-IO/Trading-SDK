"use client";

import {
  getUserSubAccountsAddressesQueryOptions,
  type ConfigParameter,
  type GetUserSubAccountsAddressesOptions,
  type GetUserSubAccountsAddressesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useUserSubAccountsAddresses}: the core query options
 * (user, pagination, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseUserSubAccountsAddressesParameters = GetUserSubAccountsAddressesOptions & ConfigParameter;

/** Return type of {@link useUserSubAccountsAddresses}. */
export type UseUserSubAccountsAddressesReturnType = UseQueryResult<
  GetUserSubAccountsAddressesReturnType,
  SymmioRequestError
>;

/**
 * Read the addresses of all subaccounts owned by `parameters.user` — a lighter
 * alternative to `useUserSubAccounts` when only the addresses are needed. The
 * query is disabled until `user` is set. `chainId` defaults to the connected
 * chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: addresses } = useUserSubAccountsAddresses({ user: address });
 * ```
 */
export function useUserSubAccountsAddresses(
  parameters: UseUserSubAccountsAddressesParameters = {},
): UseUserSubAccountsAddressesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserSubAccountsAddressesQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserSubAccountsAddressesReturnType;
}
