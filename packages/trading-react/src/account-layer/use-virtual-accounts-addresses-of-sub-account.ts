"use client";

import {
  getVirtualAccountsAddressesOfSubAccountQueryOptions,
  type ConfigParameter,
  type GetVirtualAccountsAddressesOfSubAccountOptions,
  type GetVirtualAccountsAddressesOfSubAccountReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useVirtualAccountsAddressesOfSubAccount}: the core query
 * options (subAccount, pagination, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseVirtualAccountsAddressesOfSubAccountParameters = GetVirtualAccountsAddressesOfSubAccountOptions &
  ConfigParameter;

/** Return type of {@link useVirtualAccountsAddressesOfSubAccount}. */
export type UseVirtualAccountsAddressesOfSubAccountReturnType = UseQueryResult<
  GetVirtualAccountsAddressesOfSubAccountReturnType,
  SymmioRequestError
>;

/**
 * List a subaccount's Virtual Account (VA) addresses from the AccountLayer. In
 * VibeCaps/Lowcap the VA is the on-chain `partyA` for quote reads, so feed these
 * into {@link usePartyAOpenPositions} / {@link usePartyAPendingQuotes}. The query
 * is disabled until `subAccount` is set. `chainId` defaults to the connected
 * chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: vas } = useVirtualAccountsAddressesOfSubAccount({ subAccount: "0xsub…" });
 * ```
 */
export function useVirtualAccountsAddressesOfSubAccount(
  parameters: UseVirtualAccountsAddressesOfSubAccountParameters = {},
): UseVirtualAccountsAddressesOfSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getVirtualAccountsAddressesOfSubAccountQueryOptions(config, {
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
  }) as UseVirtualAccountsAddressesOfSubAccountReturnType;
}
