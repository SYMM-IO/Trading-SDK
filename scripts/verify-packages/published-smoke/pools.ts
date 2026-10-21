/** The Pools integration must be usable from packed declarations, without vendor types. */
import {
  authenticateListing,
  checkListingTokenSupport,
  getListingTokenMetadata,
  getPoolDexDataBatch,
  getPoolMaintenanceFees,
  getPoolOpenQuoteEntryPrice,
  getPoolOpenQuoteQuantity,
  getPoolPortfolio,
  getPoolPortfolioTotals,
  getPoolStatistics,
  selectPoolMetricUsd,
  type Config,
  type ListingSignInMessage,
  type PoolQuote,
} from "@symmio/trading-core";
import { beginPoolOptimisticUpdate, type PoolOptimisticClient } from "@symmio/trading-react";
import { useListingTokenMetadata, useListingTokenSupport, usePoolMaintenanceFees } from "@symmio/trading-react/pools";

export function poolReads(config: Config, accessToken: string, signInMessage: ListingSignInMessage) {
  const token = { chainId: 42161, depositChain: 0, tokenContractAddress: "ExactSolanaMint", accessToken };
  return [
    getListingTokenMetadata(config, token),
    checkListingTokenSupport(config, token),
    getPoolMaintenanceFees(config, token),
    getPoolPortfolio(config, { chainId: 42161, accessToken }),
    getPoolDexDataBatch([token.tokenContractAddress]),
    authenticateListing(config, { chainId: 42161, domain: "app.example", uri: "https://app.example", signInMessage }),
  ];
}

export function projectPool(client: PoolOptimisticClient) {
  const projection = beginPoolOptimisticUpdate(client, [{ queryKey: ["existing-pool"], apply: (current) => current }]);
  projection.rollback();
  const stats = getPoolStatistics({ shareFraction: null });
  const totals = getPoolPortfolioTotals([], [], []);
  const metric: number | undefined = selectPoolMetricUsd(undefined, 0);
  return { stats, totals, metric };
}

void [useListingTokenMetadata, useListingTokenSupport, usePoolMaintenanceFees];

/** Selectors must accept the SDK's own normalized read result. */
export function quoteMetrics(quote: PoolQuote) {
  return { entry: getPoolOpenQuoteEntryPrice(quote), remaining: getPoolOpenQuoteQuantity(quote) };
}
