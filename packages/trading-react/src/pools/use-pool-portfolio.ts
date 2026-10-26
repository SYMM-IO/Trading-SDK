"use client";
import type {
  UserListingMarket,
  UserListingMarketPage,
  UserTransaction,
  UserTransactionPage,
} from "@symmio/trading-core";
import { normalizeSymmError } from "../errors/normalize-symm-error";

import {
  calculatePoolPortfolio,
  getListingMarketDetailQueryOptions,
  getUserListingMarketsQueryOptions,
  getUserProfitQueryOptions,
  getUserTransactionsQueryOptions,
  ListingMarketStatus,
  PoolTransactionType,
  type ConfigParameter,
  type GetPoolPortfolioParameters,
  type PoolReadGap,
} from "@symmio/trading-core";
import { useQueries } from "@tanstack/react-query";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { usePoolPages } from "./use-pool-pages";
import { useUserTotalReward } from "./use-user-total-reward";

/** Full portfolio controls; filtering and pagination belong after this hook. */
export type UsePoolPortfolioParameters = GetPoolPortfolioParameters &
  ConfigParameter & { enabled?: boolean; refetchInterval?: number | false };

function useCatalog(parameters: UsePoolPortfolioParameters, marketStatus: ListingMarketStatus) {
  const config = useSymmioConfig(parameters),
    connected = useSymmioChainId();
  const enabled = (parameters.enabled ?? true) && !!parameters.accessToken && !!parameters.userAddress;
  return usePoolPages<UserListingMarketPage, UserListingMarket>({
    source: marketStatus,
    pageSize: 100,
    enabled,
    refetchInterval: parameters.refetchInterval,
    selectPage: (page) => ({ items: page.items, total: page.total }),
    identity: (row) => `${row.chainId}:${row.contractAddress}`,
    options: (offset) => {
      const options = getUserListingMarketsQueryOptions(config, {
        chainId: parameters.chainId ?? connected,
        accessToken: parameters.accessToken,
        marketStatus,
        sortBy: parameters.sortBy,
        orderBy: parameters.orderBy,
        offset,
        limit: 100,
        userAddress: parameters.userAddress,
        query: { refetchInterval: parameters.refetchInterval },
      });
      return options;
    },
  });
}
/** Compose the shared catalog, transaction, profit and reward queries into one portfolio.
 * @param parameters - Authenticated user, optional ordering, prices and polling.
 * @returns Full holdings and totals, with per-source gaps and loading/error state.
 */
export function usePoolPortfolio(parameters: UsePoolPortfolioParameters) {
  const config = useSymmioConfig(parameters),
    connected = useSymmioChainId();
  const chainId = parameters.chainId ?? connected;
  const enabled = (parameters.enabled ?? true) && !!parameters.accessToken && !!parameters.userAddress;
  const listed = useCatalog(parameters, ListingMarketStatus.LISTED);
  const review = useCatalog(parameters, ListingMarketStatus.UNDER_REVIEW);
  const rejected = useCatalog(parameters, ListingMarketStatus.REJECTED);
  const delisted = useCatalog(parameters, ListingMarketStatus.DELISTED);
  const waiting = useCatalog(parameters, ListingMarketStatus.WAITING_FOR_DEPOSIT);
  const catalogs = [listed, review, rejected, delisted, waiting];
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
        accessToken: parameters.accessToken,
        transactionType: PoolTransactionType.DEPOSIT,
        start,
        size: 100,
        userAddress: parameters.userAddress,
        query: { refetchInterval: parameters.refetchInterval },
      });
      return options;
    },
  });
  const reward = useUserTotalReward({
    config,
    chainId,
    accessToken: parameters.accessToken,
    userAddress: parameters.userAddress,
    days: parameters.rewardDays ?? 30,
    query: { enabled, refetchInterval: parameters.refetchInterval },
  });
  const gaps: PoolReadGap[] = [
    ...catalogs.flatMap((source) => source.gaps),
    ...deposits.gaps,
    ...(reward.error ? [{ source: "rewards", reason: "failed" as const }] : []),
  ];
  const source = {
    listed: listed.items,
    nonListed: catalogs.slice(1).flatMap((source) => source.items),
    deposits: deposits.items,
    reward: reward.data ?? null,
    gaps,
    prices: parameters.prices,
  };
  const ready = enabled && !deposits.isLoading && !catalogs.some((source) => source.isLoading);
  const rows = ready ? calculatePoolPortfolio({ ...source, positions: [] }).entries : [];
  const profits = useQueries({
    queries: rows.map((row) =>
      getUserProfitQueryOptions(config, {
        chainId,
        accessToken: parameters.accessToken,
        tokenContractAddress: row.tokenContractAddress,
        userAddress: parameters.userAddress,
        query: { enabled, refetchInterval: parameters.refetchInterval },
      }),
    ),
  });
  const details = useQueries({
    queries: rows.map((row) =>
      getListingMarketDetailQueryOptions(config, {
        chainId,
        tokenContractAddress: row.tokenContractAddress,
        depositChain: row.depositChain,
        query: { enabled, refetchInterval: parameters.refetchInterval },
      }),
    ),
  });
  const positions = rows.map((row, index) => {
    if (profits[index]?.error)
      gaps.push({ source: "profit", tokenContractAddress: row.tokenContractAddress, reason: "failed" });
    if (details[index]?.error)
      gaps.push({ source: "detail", tokenContractAddress: row.tokenContractAddress, reason: "failed" });
    return {
      tokenContractAddress: row.tokenContractAddress,
      depositChain: row.depositChain,
      profit: profits[index]?.data ?? null,
      detail: details[index]?.data ?? null,
    };
  });
  const isLoading =
    enabled &&
    (!ready || reward.isPending || profits.some((row) => row.isPending) || details.some((row) => row.isPending));
  const sources = [...catalogs, deposits, reward, ...profits, ...details];
  return {
    data: ready && !isLoading ? calculatePoolPortfolio({ ...source, positions }) : undefined,
    isLoading,
    isFetching: sources.some((source) => source.isFetching),
    error: sources.find((source) => source.error)?.error
      ? normalizeSymmError(sources.find((source) => source.error)!.error)
      : null,
    refetch: () => Promise.all(enabled ? sources.map((source) => source.refetch()) : []),
  };
}
/** Result of usePoolPortfolio. */
export type UsePoolPortfolioReturnType = ReturnType<typeof usePoolPortfolio>;
