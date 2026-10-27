import type { Config } from "../../core/config";
import { readOptional, readPages, type PoolReadGap } from "../composition";
import { getListingMarketDetail } from "../market-detail/get-listing-market-detail";
import { getUserProfit } from "../profit/get-user-profit";
import { getUserTotalReward } from "../rewards/get-user-total-reward";
import { ListingMarketStatus, PoolTransactionType } from "../types";
import { getUserListingMarkets, type GetUserListingMarketsParameters } from "../user-markets/get-user-listing-markets";
import { getUserTransactions } from "../user-transactions/get-user-transactions";
import { calculatePoolPortfolio, type PoolPortfolio, type PoolPortfolioPrice } from "./calculate-pool-portfolio";

/** Full portfolio inputs. Filter after assembly; userAddress scopes private query caches. */
export type GetPoolPortfolioParameters = Pick<
  GetUserListingMarketsParameters,
  "chainId" | "accessToken" | "sortBy" | "orderBy"
> & {
  userAddress: string;
  /** Reward window, 1–30 days. Defaults to 30. */
  rewardDays?: number;
  prices?: readonly PoolPortfolioPrice[];
};
/** Portfolio entries, totals and explicit gaps. */
export type GetPoolPortfolioReturnType = PoolPortfolio;

/** Read a bounded portfolio before client filters. Each source is capped at ten pages.
 * @param config - SDK configuration.
 * @param parameters - Authenticated user, optional ordering and external prices.
 * @returns Positions and totals with failed, repeated or truncated source information.
 */
export async function getPoolPortfolio(config: Config, parameters: GetPoolPortfolioParameters): Promise<PoolPortfolio> {
  const gaps: PoolReadGap[] = [];
  const { chainId, accessToken, sortBy, orderBy } = parameters;
  const statuses = [
    ListingMarketStatus.LISTED,
    ListingMarketStatus.UNDER_REVIEW,
    ListingMarketStatus.REJECTED,
    ListingMarketStatus.DELISTED,
    ListingMarketStatus.WAITING_FOR_DEPOSIT,
  ];
  const [catalog, deposits, reward] = await Promise.all([
    Promise.all(
      statuses.map((marketStatus) =>
        readOptional(
          () =>
            readPages(
              async (offset) => {
                const page = await getUserListingMarkets(config, {
                  chainId,
                  accessToken,
                  sortBy,
                  orderBy,
                  marketStatus,
                  offset,
                  limit: 100,
                });
                return { items: page.items, total: page.total };
              },
              (row) => `${row.chainId}:${row.contractAddress}`,
              gaps,
              marketStatus,
            ),
          gaps,
          marketStatus,
        ),
      ),
    ),
    readOptional(
      () =>
        readPages(
          async (start) => {
            const page = await getUserTransactions(config, {
              chainId,
              accessToken,
              transactionType: PoolTransactionType.DEPOSIT,
              start,
              size: 100,
            });
            return { items: page.items, total: page.count };
          },
          (row) => row.transactionId,
          gaps,
          "deposits",
        ),
      gaps,
      "deposits",
    ),
    readOptional(
      () =>
        getUserTotalReward(config, {
          chainId,
          accessToken,
          userAddress: parameters.userAddress,
          days: parameters.rewardDays ?? 30,
        }),
      gaps,
      "rewards",
    ),
  ]);
  const sources = {
    listed: catalog[0] ?? [],
    nonListed: catalog.slice(1).flatMap((rows) => rows ?? []),
    deposits,
    reward,
    gaps,
    prices: parameters.prices,
  };
  const holdings = calculatePoolPortfolio({ ...sources, positions: [] }).entries;
  const positions = [];
  for (let offset = 0; offset < holdings.length; offset += 8) {
    positions.push(
      ...(await Promise.all(
        holdings.slice(offset, offset + 8).map(async (row) => {
          const tokenContractAddress = row.tokenContractAddress;
          const [profit, detail] = await Promise.all([
            readOptional(
              () => getUserProfit(config, { chainId, accessToken, tokenContractAddress }),
              gaps,
              "profit",
              tokenContractAddress,
            ),
            readOptional(
              () => getListingMarketDetail(config, { chainId, tokenContractAddress, depositChain: row.depositChain }),
              gaps,
              "detail",
              tokenContractAddress,
            ),
          ]);
          return { tokenContractAddress, depositChain: row.depositChain, profit, detail };
        }),
      )),
    );
  }
  return calculatePoolPortfolio({ ...sources, positions });
}
