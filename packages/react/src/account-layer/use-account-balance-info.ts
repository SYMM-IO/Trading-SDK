"use client";

import {
  getAccountBalanceInfoQueryOptions,
  type ConfigParameter,
  type GetAccountBalanceInfoOptions,
  type GetAccountBalanceInfoReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useAccountBalanceInfo}: the core query options
 * (account, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseAccountBalanceInfoParameters = GetAccountBalanceInfoOptions & ConfigParameter;

/** Return type of {@link useAccountBalanceInfo}. */
export type UseAccountBalanceInfoReturnType = UseQueryResult<GetAccountBalanceInfoReturnType, SymmioRequestError>;

/**
 * Read raw `balanceInfoOfPartyA` fields for a SYMMIO account. The query is
 * disabled until `account` is set. Omitted `chainId` resolves through the SDK
 * config. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAccountBalanceInfo({ account });
 * ```
 */
export function useAccountBalanceInfo(
  parameters: UseAccountBalanceInfoParameters = {},
): UseAccountBalanceInfoReturnType {
  const config = useSymmioConfig(parameters);
  const options = getAccountBalanceInfoQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAccountBalanceInfoReturnType;
}
