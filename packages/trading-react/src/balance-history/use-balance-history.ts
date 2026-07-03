"use client";

import {
  getBalanceHistoryQueryOptions,
  type ConfigParameter,
  type GetBalanceHistoryOptions,
  type GetBalanceHistoryReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useBalanceHistory}: the core query options (accounts,
 * filter, paging, time range, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseBalanceHistoryParameters = GetBalanceHistoryOptions & ConfigParameter;

/** Return type of {@link useBalanceHistory}. */
export type UseBalanceHistoryReturnType = UseQueryResult<GetBalanceHistoryReturnType, SymmioRequestError>;

/**
 * Read a sub-account's deposit / withdraw history from the analytics subgraph.
 * Each row is one settled collateral movement (deposit, withdraw, or bridge
 * withdraw); `amount` is raw `bigint` in collateral decimals. The query is
 * disabled until at least one `account` is supplied; `chainId` defaults to the
 * connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useBalanceHistory({ accounts: [subAccount], filter: BalanceHistoryFilter.Withdraw });
 * data?.rows.map((row) => row.transaction);
 * ```
 */
export function useBalanceHistory(parameters: UseBalanceHistoryParameters): UseBalanceHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getBalanceHistoryQueryOptions(config, {
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
  }) as UseBalanceHistoryReturnType;
}
