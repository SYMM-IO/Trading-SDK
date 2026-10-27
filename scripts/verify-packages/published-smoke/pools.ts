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
  getPoolQuotes,
  getPoolStatistics,
  getPoolStatisticsQueryOptions,
  getPoolTradeHistory,
  type Config,
  type ListingMarketDetail,
  type PoolQuote,
  type PoolQuoteBookEntry,
  type PoolTradeHistoryRow,
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
    getPoolPosition(config, { ...pool, withdrawalPercent: 100 }),
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
      withdrawalPercent: 50,
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

/** Verify derived read types and exact position amounts from a packed external consumer. */
export async function detailMetrics(config: Config) {
  const { quotes } = await getPoolQuotes(config, { symbolId: 1 });
  const { rows } = await getPoolTradeHistory(config, { symbolId: 1 });
  const quote: PoolQuoteBookEntry | undefined = quotes[0];
  const row: PoolTradeHistoryRow | undefined = rows[0];
  const amounts: (bigint | null | undefined)[] = [quote?.orderNotional, row?.openFee, row?.closeFee, row?.realizedPnl];
  return amounts;
}
