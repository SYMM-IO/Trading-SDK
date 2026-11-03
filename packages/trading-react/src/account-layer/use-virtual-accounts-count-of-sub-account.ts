"use client";

import {
  getVirtualAccountsCountOfSubAccountQueryOptions,
  type ConfigParameter,
  type GetVirtualAccountsCountOfSubAccountOptions,
  type GetVirtualAccountsCountOfSubAccountReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useVirtualAccountsCountOfSubAccount}: the core query
 * options (subAccount, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseVirtualAccountsCountOfSubAccountParameters = GetVirtualAccountsCountOfSubAccountOptions &
  ConfigParameter;

/** Return type of {@link useVirtualAccountsCountOfSubAccount}. */
export type UseVirtualAccountsCountOfSubAccountReturnType = UseQueryResult<
  GetVirtualAccountsCountOfSubAccountReturnType,
  SymmioRequestError
>;

/**
 * Read how many Virtual Accounts (VAs) a subaccount holds — for paging the VA
 * lists past their default limit of 200. The query is disabled until
 * `subAccount` is set. `chainId` defaults to the connected chain. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: count } = useVirtualAccountsCountOfSubAccount({ subAccount: "0xsub…", chainId });
 * ```
 */
export function useVirtualAccountsCountOfSubAccount(
  parameters: UseVirtualAccountsCountOfSubAccountParameters = {},
): UseVirtualAccountsCountOfSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getVirtualAccountsCountOfSubAccountQueryOptions(config, {
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
  }) as UseVirtualAccountsCountOfSubAccountReturnType;
}
