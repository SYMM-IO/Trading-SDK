"use client";
import type { PoolTransaction, PoolTransactionPage } from "@symmio/trading-core";

import {
  calculatePoolStatistics,
  getPoolTransactionsQueryOptions,
  PoolTransactionStatus,
  PoolTransactionType,
  type ConfigParameter,
  type GetPoolStatisticsParameters,
  type PoolReadGap,
} from "@symmio/trading-core";
import { useMarketInfo } from "../market-info/use-market-info";
import { useNotionalCapBySymbolId } from "../notional-cap/use-notional-cap-by-symbol-id";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useListingMarketDetail } from "./use-listing-market-detail";
import { usePoolPages } from "./use-pool-pages";
import { usePoolRewardChart } from "./use-pool-reward-chart";
import { useUserProfit } from "./use-user-profit";

/** Statistics hook inputs, with independent shared-query polling controls. */
export type UsePoolStatisticsParameters = GetPoolStatisticsParameters &
  ConfigParameter & { enabled?: boolean; refetchInterval?: number | false };
/** Compose existing listing, rewards, pending-transaction and solver hooks into statistics.
 * @param parameters - Pool identity, scope and optional external price/poll interval.
 * @returns Flat statistics with source gaps; user scope never substitutes the pool-wide queue.
 */
export function usePoolStatistics(parameters: UsePoolStatisticsParameters) {
  const config = useSymmioConfig(parameters),
    connected = useSymmioChainId();
  const chainId = parameters.chainId ?? connected;
  const enabled =
    (parameters.enabled ?? true) &&
    !!parameters.tokenContractAddress &&
    (parameters.scope !== "user" || (!!parameters.accessToken && !!parameters.userAddress));
  const query = { enabled, refetchInterval: parameters.refetchInterval };
  const { tokenContractAddress, depositChain } = parameters;
  const detail = useListingMarketDetail({ config, chainId, tokenContractAddress, depositChain, query });
  const reward = usePoolRewardChart({
    config,
    chainId,
    marketAddress: tokenContractAddress,
    marketChainId: depositChain,
    query,
  });
  const profit = useUserProfit({
    config,
    chainId,
    tokenContractAddress,
    accessToken: parameters.accessToken ?? "",
    userAddress: parameters.userAddress,
    query: { ...query, enabled: enabled && parameters.scope === "user" },
  });
  const symbolId = detail.data?.symbolId;
  const solverQuery = { ...query, enabled: enabled && symbolId != null };
  const cap = useNotionalCapBySymbolId({ config, chainId, symbolId: symbolId ?? 0, query: solverQuery });
  const info = useMarketInfo({ config, chainId, query: solverQuery });
  const pending = usePoolPages<PoolTransactionPage, PoolTransaction>({
    source: "pending",
    pageSize: 50,
    enabled: enabled && parameters.scope !== "user",
    refetchInterval: parameters.refetchInterval,
    selectPage: (page) => ({ items: page.items, total: page.count }),
    identity: (row) => row.transactionId,
    options: (start) => {
      const options = getPoolTransactionsQueryOptions(config, {
        chainId,
        tokenAddress: tokenContractAddress,
        marketChainId: depositChain,
        transactionType: PoolTransactionType.WITHDRAW,
        transactionStatus: PoolTransactionStatus.PENDING,
        start,
        size: 50,
        query,
      });
      return options;
    },
  });
  const sources = [
    { source: "detail", query: detail },
    { source: "rewards", query: reward },
    ...(parameters.scope === "user" ? [{ source: "profit", query: profit }] : []),
    ...(symbolId != null
      ? [
          { source: "notionalCap", query: cap },
          { source: "marketInfo", query: info },
        ]
      : []),
  ];
  const gaps: PoolReadGap[] = [
    ...pending.gaps,
    ...sources.flatMap((row) => (row.query.error ? [{ source: row.source, reason: "failed" as const }] : [])),
  ];
  const isLoading = enabled && (pending.isLoading || sources.some((row) => row.query.isPending));
  return {
    data:
      enabled && !isLoading
        ? calculatePoolStatistics({
            ...parameters,
            detail: detail.data ?? null,
            rewards: reward.data ?? null,
            profit: profit.data ?? null,
            notionalCap: cap.data ?? null,
            marketInfo: info.data ?? null,
            pending: pending.gaps.length ? null : pending.items,
            gaps,
          })
        : undefined,
    isLoading,
    isFetching: pending.isFetching || sources.some((row) => row.query.isFetching),
    error: sources.find((row) => row.query.error)?.query.error ?? pending.error,
    refetch: () => Promise.all(enabled ? [pending.refetch(), ...sources.map((row) => row.query.refetch())] : []),
  };
}
/** Result of usePoolStatistics. */
export type UsePoolStatisticsReturnType = ReturnType<typeof usePoolStatistics>;
