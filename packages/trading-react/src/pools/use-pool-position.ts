"use client";
import type { UserTransaction, UserTransactionPage } from "@symmio/trading-core";

import {
  calculatePoolPosition,
  getUserTransactionsQueryOptions,
  PoolTransactionType,
  type ConfigParameter,
  type GetPoolPositionParameters,
  type PoolReadGap,
} from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useListingMarketDetail } from "./use-listing-market-detail";
import { usePoolPages } from "./use-pool-pages";
import { useUserProfit } from "./use-user-profit";

/** Position hook inputs; refetchInterval applies to the shared source queries. */
export type UsePoolPositionParameters = GetPoolPositionParameters &
  ConfigParameter & { enabled?: boolean; refetchInterval?: number | false };
/** Observe a stake through existing cached reads; no parallel aggregate cache is created.
 * @param parameters - Pool identity, authenticated wallet and optional price/poll interval.
 * @returns A position, loading/error state and explicit refetch control.
 */
export function usePoolPosition(parameters: UsePoolPositionParameters) {
  const config = useSymmioConfig(parameters),
    connectedChain = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChain;
  const enabled =
    (parameters.enabled ?? true) &&
    !!parameters.accessToken &&
    !!parameters.userAddress &&
    !!parameters.tokenContractAddress;
  const query = { enabled, refetchInterval: parameters.refetchInterval };
  const { tokenContractAddress, depositChain, accessToken } = parameters;
  const detail = useListingMarketDetail({ config, chainId, tokenContractAddress, depositChain, query });
  const profit = useUserProfit({
    config,
    chainId,
    tokenContractAddress,
    accessToken,
    userAddress: parameters.userAddress,
    query,
  });
  const deposits = usePoolPages<UserTransactionPage, UserTransaction>({
    source: "deposits",
    pageSize: 100,
    enabled,
    refetchInterval: parameters.refetchInterval,
    selectPage: (page) => ({ items: page.items, total: page.count }),
    identity: (row) => row.transactionId,
    options: (start) => {
      const options = getUserTransactionsQueryOptions(config, {
        chainId,
        accessToken,
        tokenAddress: tokenContractAddress,
        transactionType: PoolTransactionType.DEPOSIT,
        start,
        size: 100,
        userAddress: parameters.userAddress,
        query,
      });
      return options;
    },
  });
  const gaps: PoolReadGap[] = [
    ...deposits.gaps,
    ...(detail.error ? [{ source: "detail", reason: "failed" as const }] : []),
    ...(profit.error ? [{ source: "profit", reason: "failed" as const }] : []),
  ];
  const isLoading = enabled && (detail.isPending || profit.isPending || deposits.isLoading);
  return {
    data:
      enabled && !isLoading
        ? calculatePoolPosition({
            ...parameters,
            detail: detail.data ?? null,
            profit: profit.data ?? null,
            deposits: deposits.items,
            depositsComplete: !deposits.gaps.length,
            gaps,
          })
        : undefined,
    isLoading,
    isFetching: detail.isFetching || profit.isFetching || deposits.isFetching,
    error: detail.error ?? profit.error ?? deposits.error,
    refetch: () => Promise.all(enabled ? [detail.refetch(), profit.refetch(), deposits.refetch()] : []),
  };
}
/** Result of usePoolPosition. */
export type UsePoolPositionReturnType = ReturnType<typeof usePoolPosition>;
