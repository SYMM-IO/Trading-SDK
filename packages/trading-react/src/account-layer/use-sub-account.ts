"use client";

import {
  getSubAccountQueryOptions,
  type ConfigParameter,
  type GetSubAccountOptions,
  type GetSubAccountReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSubAccount}: the core query options (account, chain
 * id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSubAccountParameters = GetSubAccountOptions & ConfigParameter;

/** Return type of {@link useSubAccount}. */
export type UseSubAccountReturnType = UseQueryResult<GetSubAccountReturnType, SymmioRequestError>;

/**
 * Read a single SYMMIO subaccount by its address. The query is disabled until
 * `account` is set. `chainId` defaults to the connected chain. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: sub, isLoading, error } = useSubAccount({ account: "0xsub…" });
 * ```
 */
export function useSubAccount(parameters: UseSubAccountParameters = {}): UseSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSubAccountQueryOptions(config, {
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
  }) as UseSubAccountReturnType;
}
