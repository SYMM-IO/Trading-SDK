"use client";
import type { GetPoolQuotesReturnType, PoolQuote } from "@symmio/trading-core";
import { normalizeSymmError } from "../errors/normalize-symm-error";

import {
  calculatePoolOpenPositions,
  getAccountBalanceInfoQueryOptions,
  getPoolQuotesQueryOptions,
  POOL_OPEN_QUOTE_STATUSES,
  type ConfigParameter,
  type GetPoolOpenPositionsParameters,
  type PoolReadGap,
} from "@symmio/trading-core";
import { useQueries } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { usePoolPages } from "./use-pool-pages";

/** Open-book projection controls. Consumers page the derived rows after account-wide calculations. */
export type UsePoolOpenPositionsParameters = GetPoolOpenPositionsParameters &
  ConfigParameter & { enabled?: boolean; refetchInterval?: number | false };
/** Compose shared quote and account-balance queries without a second data cache.
 * @param parameters - Market, optional mark price, and query controls.
 * @returns Derived open positions and explicit source gaps.
 */
export function usePoolOpenPositions(parameters: UsePoolOpenPositionsParameters) {
  const config = useSymmioConfig(parameters),
    connected = useSymmioChainId();
  const chainId = parameters.chainId ?? connected,
    enabled = parameters.enabled ?? true;
  const quotes = usePoolPages<GetPoolQuotesReturnType, PoolQuote>({
    source: "quotes",
    pageSize: 100,
    enabled,
    refetchInterval: parameters.refetchInterval,
    selectPage: (page, skip) => ({
      items: page.quotes,
      total: page.quotes.length < 100 ? skip + page.quotes.length : Number.MAX_SAFE_INTEGER,
    }),
    identity: (row) => row.id,
    options: (skip) => {
      const options = getPoolQuotesQueryOptions(config, {
        chainId,
        symbolId: parameters.symbolId,
        orderDirection: parameters.orderDirection,
        quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
        first: 100,
        skip,
        query: { refetchInterval: parameters.refetchInterval },
      });
      return options;
    },
  });
  const accounts = [...new Set(quotes.items.map((row) => row.partyA.toLowerCase()))];
  const reads = useQueries({
    queries: accounts.map((account) =>
      getAccountBalanceInfoQueryOptions(config, {
        chainId,
        account: account as Address,
        query: { enabled, refetchInterval: parameters.refetchInterval },
      }),
    ),
  });
  const balances = Object.fromEntries(accounts.map((account, index) => [account, reads[index]?.data ?? null]));
  const gaps: PoolReadGap[] = [
    ...quotes.gaps,
    ...accounts.flatMap((account, index) =>
      reads[index]?.error
        ? [{ source: "accountBalance", tokenContractAddress: account, reason: "failed" as const }]
        : [],
    ),
  ];
  const isLoading = enabled && (quotes.isLoading || reads.some((row) => row.isPending));
  return {
    data:
      enabled && !isLoading
        ? calculatePoolOpenPositions({
            quotes: quotes.items,
            balances,
            priceUsd: parameters.priceUsd,
            complete: !quotes.gaps.length,
            gaps,
          })
        : undefined,
    isLoading,
    isFetching: quotes.isFetching || reads.some((row) => row.isFetching),
    error:
      quotes.error ??
      (reads.find((row) => row.error)?.error ? normalizeSymmError(reads.find((row) => row.error)!.error) : null),
    refetch: () => Promise.all(enabled ? [quotes.refetch(), ...reads.map((row) => row.refetch())] : []),
  };
}
/** Result of usePoolOpenPositions. */
export type UsePoolOpenPositionsReturnType = ReturnType<typeof usePoolOpenPositions>;
