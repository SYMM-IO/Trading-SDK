import type { Config } from "../../core/config";
import { assemblePoolPortfolio, type PoolPortfolioEntry } from "../calculations/portfolio";
import { ListingMarketStatus, PoolTransactionType, type UserListingMarket, type UserTransaction } from "../types";
import { getUserListingMarkets, type GetUserListingMarketsParameters } from "../user-markets/get-user-listing-markets";
import { getUserTransactions } from "../user-transactions/get-user-transactions";

/** Portfolio filters apply to the listed search. Client presentation filters and pagination follow full assembly. */
export type GetPoolPortfolioParameters = Omit<GetUserListingMarketsParameters, "limit" | "offset" | "marketStatus">;
/** A normalized deposit with its portfolio identity. */
export type PoolPortfolioTransaction = UserTransaction & { contractAddress: string };
/** Complete portfolio entries before display filtering. */
export type GetPoolPortfolioReturnType = PoolPortfolioEntry<UserListingMarket, PoolPortfolioTransaction>[];

/** Read all listed user rows, status lookups and up to 1,000 deposit records, preserving the established request budget. */
export async function getPoolPortfolio(
  config: Config,
  parameters: GetPoolPortfolioParameters,
): Promise<GetPoolPortfolioReturnType> {
  async function search(options: GetUserListingMarketsParameters) {
    const first = await getUserListingMarkets(config, { ...options, offset: 0, limit: 100 });
    const items = [...first.items];
    while (items.length < first.total) {
      const next = await getUserListingMarkets(config, { ...options, offset: items.length, limit: 100 });
      if (!next.items.length) break;
      items.push(...next.items);
    }
    return items;
  }
  async function deposits() {
    const options = {
      chainId: parameters.chainId,
      accessToken: parameters.accessToken,
      transactionType: PoolTransactionType.DEPOSIT,
      size: 100,
    };
    const first = await getUserTransactions(config, options);
    const items = [...first.items];
    while (items.length < first.count && items.length < 1000) {
      const next = await getUserTransactions(config, { ...options, start: items.length });
      if (!next.items.length) break;
      items.push(...next.items);
    }
    return items.map((item) => ({ ...item, contractAddress: item.tokenAddress }));
  }
  const [listed, nonListed, transactions] = await Promise.all([
    search(parameters),
    Promise.all(
      [
        ListingMarketStatus.UNDER_REVIEW,
        ListingMarketStatus.REJECTED,
        ListingMarketStatus.DELISTED,
        ListingMarketStatus.WAITING_FOR_DEPOSIT,
      ].map((marketStatus) =>
        search({ chainId: parameters.chainId, accessToken: parameters.accessToken, marketStatus }).catch(() => []),
      ),
    ),
    deposits(),
  ]);
  return assemblePoolPortfolio(listed, nonListed.flat(), transactions);
}
