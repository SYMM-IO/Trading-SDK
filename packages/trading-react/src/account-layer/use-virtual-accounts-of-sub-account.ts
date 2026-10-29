"use client";

import {
  getVirtualAccountsOfSubAccountQueryOptions,
  type ConfigParameter,
  type GetVirtualAccountsOfSubAccountOptions,
  type GetVirtualAccountsOfSubAccountReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useVirtualAccountsOfSubAccount}: the core query
 * options (subAccount, pagination, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseVirtualAccountsOfSubAccountParameters = GetVirtualAccountsOfSubAccountOptions & ConfigParameter;

/** Return type of {@link useVirtualAccountsOfSubAccount}. */
export type UseVirtualAccountsOfSubAccountReturnType = UseQueryResult<
  GetVirtualAccountsOfSubAccountReturnType,
  SymmioRequestError
>;

/**
 * List a subaccount's Virtual Accounts (VAs) **with their details** — market
 * (`symbolId`), parent, isolation type — in one AccountLayer call. The query is
 * disabled until `subAccount` is set; one call with the default `limit` covers
 * up to 200 VAs. `chainId` defaults to the connected chain. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: vas } = useVirtualAccountsOfSubAccount({ subAccount: "0xsub…", chainId });
 * ```
 */
export function useVirtualAccountsOfSubAccount(
  parameters: UseVirtualAccountsOfSubAccountParameters = {},
): UseVirtualAccountsOfSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getVirtualAccountsOfSubAccountQueryOptions(config, {
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
  }) as UseVirtualAccountsOfSubAccountReturnType;
}
