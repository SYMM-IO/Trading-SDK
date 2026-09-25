import {
  POOL_OPEN_QUOTE_STATUSES,
  authenticateListing,
  getClaimHistory,
  getListingConfig,
  getListingMarketConfig,
  getListingMarketDetail,
  getListingMarkets,
  getListingStatus,
  getPoolQuotes,
  getPoolRewardChart,
  getPoolTotalReward,
  getPoolTradeHistory,
  getPoolTransactions,
  getUserListingMarkets,
  getUserProfit,
  getUserRewardChart,
  getUserTotalReward,
  getUserTransactions,
  getWeeklyListingLimit,
  supportsListingService,
  type ListingAuthToken,
  type ListingMarket,
  type ListingMarketStatus,
} from "@symmio/trading-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSigner } from "./use-signer.js";

/** Rows shown on one terminal page. */
export const POOLS_PAGE_SIZE = 8;

/** Detail panels whose queries are loaded on demand. */
export type PoolDetailSection = "overview" | "rewards" | "activity" | "status";

/** Whether the active chain exposes the optional listing backend. */
export function useSupportsListingService(): boolean {
  const { config, chainId } = useSdkScope();
  return supportsListingService(config, { chainId });
}

/** Public service configuration and the global rolling weekly listing limit. */
export function useListingOverview(enabled = true) {
  const { config, chainId } = useSdkScope();
  const supported = supportsListingService(config, { chainId });
  const canRead = enabled && supported;

  const listingConfig = useQuery({
    queryKey: ["pools", "config", chainId],
    queryFn: () => getListingConfig(config, { chainId }),
    enabled: canRead,
    staleTime: 5 * 60_000,
  });

  const weeklyLimit = useQuery({
    queryKey: ["pools", "weekly-limit", chainId],
    queryFn: () => getWeeklyListingLimit(config, { chainId }),
    enabled: canRead,
    staleTime: 60_000,
  });

  return { listingConfig, weeklyLimit };
}

export interface UseListingCatalogParameters {
  page: number;
  status?: ListingMarketStatus;
  enabled?: boolean;
}

/** One server-paginated page of the public Pools catalog. */
export function useListingCatalog({ page, status, enabled = true }: UseListingCatalogParameters) {
  const { config, chainId } = useSdkScope();
  const supported = supportsListingService(config, { chainId });

  return useQuery({
    queryKey: ["pools", "catalog", chainId, status ?? "all", page],
    queryFn: () =>
      getListingMarkets(config, {
        chainId,
        marketStatus: status,
        limit: POOLS_PAGE_SIZE,
        offset: (page - 1) * POOLS_PAGE_SIZE,
        sortBy: "tvl",
        orderBy: "desc",
      }),
    enabled: enabled && supported,
    staleTime: 30_000,
  });
}

/**
 * An in-memory listing-backend session. The bearer credential is never
 * persisted, rendered, or included in a query key. Signing is explicit: the
 * caller invokes `signIn` from a user keypress.
 */
export function useListingSession() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const signer = useSigner();
  const scopeKey = `${chainId}:${signer.address ?? "disconnected"}`;
  const [session, setSession] = useState<{
    scopeKey: string;
    token: ListingAuthToken;
    revision: number;
  } | null>(null);

  const authentication = useMutation({
    mutationKey: ["pools", "authenticate", scopeKey],
    mutationFn: async () => {
      if (!signer.address || !signer.canSign) {
        throw new Error("Connect a signing wallet before signing in to Pools.");
      }
      return authenticateListing(config, {
        chainId,
        domain: "localhost",
        uri: "http://localhost",
        statement: "Sign in to SYMMIO Pools from the terminal.",
      });
    },
    onSuccess: (token) => {
      setSession((current) => ({
        scopeKey,
        token,
        revision: (current?.revision ?? 0) + 1,
      }));
    },
  });

  useEffect(() => {
    authentication.reset();
  }, [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSession = session?.scopeKey === scopeKey ? session : null;
  const signOut = useCallback(() => {
    setSession(null);
    authentication.reset();
    queryClient.removeQueries({ queryKey: ["pools", "user"] });
  }, [authentication, queryClient]);

  return {
    accessToken: activeSession?.token.accessToken,
    revision: activeSession?.revision ?? 0,
    isAuthenticated: activeSession != null,
    isSigningIn: authentication.isPending,
    error: authentication.error,
    canSign: signer.canSign,
    address: signer.address,
    signIn: authentication.mutate,
    signOut,
  };
}

export interface UseUserListingCatalogParameters extends UseListingCatalogParameters {
  accessToken?: string;
  address?: string;
  revision: number;
}

/** One page of pools associated with the authenticated listing user. */
export function useUserListingCatalog({
  accessToken,
  address,
  revision,
  page,
  status,
  enabled = true,
}: UseUserListingCatalogParameters) {
  const { config, chainId } = useSdkScope();
  const supported = supportsListingService(config, { chainId });

  return useQuery({
    queryKey: ["pools", "user", "catalog", chainId, address, revision, status ?? "all", page],
    queryFn: () => {
      if (!accessToken) throw new Error("Sign in to read your pools.");
      return getUserListingMarkets(config, {
        chainId,
        accessToken,
        marketStatus: status,
        limit: POOLS_PAGE_SIZE,
        offset: (page - 1) * POOLS_PAGE_SIZE,
        sortBy: "tvl",
        orderBy: "desc",
      });
    },
    enabled: enabled && supported && Boolean(accessToken && address),
    staleTime: 20_000,
    retry: false,
  });
}

/** Public reads for one selected pool, loaded according to the visible section. */
export function usePublicPoolData(market: ListingMarket | undefined, section: PoolDetailSection, enabled = true) {
  const { config, chainId } = useSdkScope();
  const supported = supportsListingService(config, { chainId });
  const address = market?.contractAddress;
  const depositChain = market?.chainId;
  const symbolId = market?.symbolId;
  const canRead = enabled && supported && market != null;
  const overviewVisible = section === "overview";
  const rewardsVisible = section === "rewards";
  const activityVisible = section === "activity";
  const statusVisible = section === "status" || overviewVisible;

  const detail = useQuery({
    queryKey: ["pools", "detail", chainId, depositChain, address],
    queryFn: () => {
      if (!address || depositChain === undefined) throw new Error("Select a pool to read its detail.");
      return getListingMarketDetail(config, { chainId, tokenContractAddress: address, depositChain });
    },
    enabled: canRead && (overviewVisible || section === "status"),
    staleTime: 20_000,
  });

  const status = useQuery({
    queryKey: ["pools", "status", chainId, depositChain, address],
    queryFn: () => {
      if (!address || depositChain === undefined) throw new Error("Select a pool to read its status.");
      return getListingStatus(config, { chainId, tokenContractAddress: address, depositChain });
    },
    enabled: canRead && statusVisible,
    staleTime: 15_000,
    refetchInterval: market?.marketStatus === "listed" || market?.marketStatus === "delisted" ? false : 15_000,
  });

  const rewardTotal = useQuery({
    queryKey: ["pools", "reward-total", chainId, depositChain, address, 30],
    queryFn: () => {
      if (!address || depositChain === undefined) throw new Error("Select a pool to read its rewards.");
      return getPoolTotalReward(config, { chainId, marketAddress: address, marketChainId: depositChain, days: 30 });
    },
    enabled: canRead && rewardsVisible,
    staleTime: 30_000,
  });

  const rewardChart = useQuery({
    queryKey: ["pools", "reward-chart", chainId, depositChain, address],
    queryFn: () => {
      if (!address || depositChain === undefined) throw new Error("Select a pool to read its reward chart.");
      return getPoolRewardChart(config, { chainId, marketAddress: address, marketChainId: depositChain });
    },
    enabled: canRead && rewardsVisible,
    staleTime: 30_000,
  });

  const transactions = useQuery({
    queryKey: ["pools", "transactions", chainId, address],
    queryFn: () => {
      if (!address) throw new Error("Select a pool to read its transactions.");
      return getPoolTransactions(config, { chainId, marketAddress: address, size: 6 });
    },
    enabled: canRead && activityVisible,
    staleTime: 15_000,
  });

  const openQuotes = useQuery({
    queryKey: ["pools", "open-quotes", chainId, symbolId],
    queryFn: () =>
      getPoolQuotes(config, {
        chainId,
        symbolId,
        quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
        first: 6,
      }),
    enabled: canRead && activityVisible && symbolId != null,
    staleTime: 15_000,
  });

  const tradeHistory = useQuery({
    queryKey: ["pools", "trade-history", chainId, symbolId],
    queryFn: () => getPoolTradeHistory(config, { chainId, symbolId, first: 6 }),
    enabled: canRead && activityVisible && symbolId != null,
    staleTime: 15_000,
  });

  return { detail, status, rewardTotal, rewardChart, transactions, openQuotes, tradeHistory };
}

/** Authenticated position, reward, preference, transaction, and claim reads. */
export function useUserPoolData({
  market,
  section,
  accessToken,
  address,
  revision,
  enabled = true,
}: {
  market?: ListingMarket;
  section: PoolDetailSection;
  accessToken?: string;
  address?: string;
  revision: number;
  enabled?: boolean;
}) {
  const { config, chainId } = useSdkScope();
  const marketAddress = market?.contractAddress;
  const depositChain = market?.chainId;
  const canRead = enabled && Boolean(accessToken && address);
  const overviewVisible = section === "overview";
  const rewardsVisible = section === "rewards";
  const activityVisible = section === "activity";
  const statusVisible = section === "status";
  const key = [chainId, address, revision] as const;

  const profit = useQuery({
    queryKey: ["pools", "user", "profit", ...key, marketAddress],
    queryFn: () => {
      if (!accessToken || !marketAddress) throw new Error("Sign in and select a pool to read profit.");
      return getUserProfit(config, { chainId, accessToken, tokenContractAddress: marketAddress });
    },
    enabled: canRead && Boolean(marketAddress) && (overviewVisible || rewardsVisible),
    staleTime: 15_000,
    retry: false,
  });

  const rewardTotal = useQuery({
    queryKey: ["pools", "user", "reward-total", ...key, 30],
    queryFn: () => {
      if (!accessToken || !address) throw new Error("Sign in to read your rewards.");
      return getUserTotalReward(config, { chainId, accessToken, userAddress: address, days: 30 });
    },
    enabled: canRead && rewardsVisible,
    staleTime: 30_000,
    retry: false,
  });

  const rewardChart = useQuery({
    queryKey: ["pools", "user", "reward-chart", ...key],
    queryFn: () => {
      if (!accessToken) throw new Error("Sign in to read your reward chart.");
      return getUserRewardChart(config, { chainId, accessToken });
    },
    enabled: canRead && rewardsVisible,
    staleTime: 30_000,
    retry: false,
  });

  const transactions = useQuery({
    queryKey: ["pools", "user", "transactions", ...key, marketAddress],
    queryFn: () => {
      if (!accessToken) throw new Error("Sign in to read your pool transactions.");
      return getUserTransactions(config, {
        chainId,
        accessToken,
        tokenAddress: marketAddress,
        size: 6,
      });
    },
    enabled: canRead && activityVisible,
    staleTime: 15_000,
    retry: false,
  });

  const claims = useQuery({
    queryKey: ["pools", "user", "claims", ...key, marketAddress],
    queryFn: () => {
      if (!accessToken) throw new Error("Sign in to read your reward claims.");
      return getClaimHistory(config, {
        chainId,
        accessToken,
        tokenContractAddress: marketAddress,
        size: 6,
      });
    },
    enabled: canRead && activityVisible,
    staleTime: 30_000,
    retry: false,
  });

  const marketConfig = useQuery({
    queryKey: ["pools", "user", "market-config", ...key, depositChain, marketAddress],
    queryFn: () => {
      if (!accessToken || !marketAddress || depositChain === undefined) {
        throw new Error("Sign in and select a pool to read your configuration.");
      }
      return getListingMarketConfig(config, {
        chainId,
        accessToken,
        tokenContractAddress: marketAddress,
        depositChain,
      });
    },
    enabled: canRead && statusVisible && Boolean(marketAddress) && depositChain !== undefined,
    staleTime: 30_000,
    retry: false,
  });

  return { profit, rewardTotal, rewardChart, transactions, claims, marketConfig };
}
