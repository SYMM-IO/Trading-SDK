import {
  calculatePoolOpenPositions,
  calculatePoolPortfolio,
  calculatePoolPosition,
  calculatePoolStatistics,
  getListingSignInMessageQueryOptions,
  getPoolOpenPositions,
  getPoolOpenPositionsQueryOptions,
  getPoolPortfolio,
  getPoolPortfolioQueryOptions,
  getPoolPosition,
  getPoolPositionQueryOptions,
  getPoolStatistics,
  getPoolStatisticsQueryOptions,
  type Config,
  type ListingMarketDetail,
  type PoolQuote,
  type UserPoolProfit,
  type UserTransaction,
} from "@symmio/trading-core";
import {
  useAuthenticateListing,
  usePoolOpenPositions,
  usePoolPortfolio,
  usePoolPosition,
  usePoolStatistics,
} from "@symmio/trading-react/pools";
export function reads(config: Config, accessToken: string, userAddress: string) {
  const pool = { chainId: 42161, tokenContractAddress: "ExactMint", depositChain: 0, accessToken, userAddress };
  return [
    getPoolPortfolio(config, { chainId: 42161, accessToken, userAddress }),
    getPoolPosition(config, pool),
    getPoolStatistics(config, { ...pool, scope: "user" }),
    getPoolOpenPositions(config, { chainId: 42161, symbolId: 1, priceUsd: 2 }),
  ];
}
export function projections(
  detail: ListingMarketDetail,
  profit: UserPoolProfit,
  deposits: UserTransaction[],
  quotes: PoolQuote[],
) {
  return [
    calculatePoolPosition({
      tokenContractAddress: detail.tokenContractAddress,
      depositChain: detail.depositChain,
      detail,
      profit,
      deposits,
    }),
    calculatePoolStatistics({
      detail,
      profit,
      scope: "user",
      pending: [],
      rewards: [],
      notionalCap: null,
      marketInfo: null,
    }),
    calculatePoolOpenPositions({ quotes, balances: {}, priceUsd: 2 }),
  ];
}
void [
  usePoolPortfolio,
  usePoolPosition,
  usePoolStatistics,
  usePoolOpenPositions,
  useAuthenticateListing,
  getListingSignInMessageQueryOptions,
  calculatePoolPortfolio,
  getPoolPortfolioQueryOptions,
  getPoolPositionQueryOptions,
  getPoolStatisticsQueryOptions,
  getPoolOpenPositionsQueryOptions,
];
