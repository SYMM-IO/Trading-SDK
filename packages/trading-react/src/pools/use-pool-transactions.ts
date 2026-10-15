"use client";

import {
  getPoolTransactionsQueryOptions,
  type ConfigParameter,
  type GetPoolTransactionsOptions,
  type GetPoolTransactionsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePoolTransactions}: the core query options plus an optional `config`. */
export type UsePoolTransactionsParameters = GetPoolTransactionsOptions & ConfigParameter;

/** Return type of {@link usePoolTransactions}: one page of transaction rows. */
export type UsePoolTransactionsReturnType = UseQueryResult<GetPoolTransactionsReturnType, SymmioRequestError>;

/**
 * Read pool deposit and withdrawal history — refunded deposits included —
 * newest first.
 *
 * Public and unscoped by default: every LP's rows on **every** pool, not just
 * the connected wallet's. Narrow it with `tokenAddress` (one pool),
 * `marketChainId`, `walletAddress`, `transactionType` and `transactionStatus`;
 * each row names its own pool (`tokenAddress`, `chainId`). The service fixes the
 * order newest first and takes no sort parameter.
 *
 * `count` is the total across all pages, so it is what a pager should divide —
 * not `items.length`. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * // One pool, 25 rows a page.
 * const { data } = usePoolTransactions({ tokenAddress, size: 25, start: page * 25 });
 *
 * // The latest activity across every pool.
 * const { data: latest } = usePoolTransactions();
 * ```
 */
export function usePoolTransactions(parameters: UsePoolTransactionsParameters = {}): UsePoolTransactionsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolTransactionsQueryOptions(config, {
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
  }) as UsePoolTransactionsReturnType;
}
