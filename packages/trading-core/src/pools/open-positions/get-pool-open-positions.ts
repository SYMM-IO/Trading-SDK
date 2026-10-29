import type { Address } from "viem";
import type { Config } from "../../core/config";
import { getAccountBalanceInfo } from "../../symmio-contracts/account-layer/actions/get-account-balance-info";
import { readOptional, readPages, type PoolReadGap } from "../composition";
import { getPoolQuotes, POOL_OPEN_QUOTE_STATUSES, type GetPoolQuotesParameters } from "../quotes/get-pool-quotes";
import { calculatePoolOpenPositions, type PoolOpenPositions } from "./calculate-pool-open-positions";

/** Read a bounded complete open book; caller filtering/paging follows calculation. */
export type GetPoolOpenPositionsParameters = Pick<
  GetPoolQuotesParameters,
  "chainId" | "symbolId" | "orderDirection"
> & { priceUsd?: number; allowQuoteLockEstimate?: boolean };
/** Result of getPoolOpenPositions. */
export type GetPoolOpenPositionsReturnType = PoolOpenPositions;

/** Read open quotes and deduplicated account balances before deriving table metrics.
 * @param config - SDK configuration.
 * @param parameters - Market identity and optional external mark price.
 * @returns Open positions and source gaps; incomplete books have no liquidation estimate.
 */
export async function getPoolOpenPositions(
  config: Config,
  parameters: GetPoolOpenPositionsParameters,
): Promise<PoolOpenPositions> {
  const gaps: PoolReadGap[] = [];
  const quotes = await readPages(
    async (skip) => {
      const page = await getPoolQuotes(config, {
        chainId: parameters.chainId,
        symbolId: parameters.symbolId,
        orderDirection: parameters.orderDirection,
        quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
        first: 100,
        skip,
      });
      return {
        items: page.quotes,
        total: page.quotes.length < 100 ? skip + page.quotes.length : Number.MAX_SAFE_INTEGER,
      };
    },
    (row) => row.id,
    gaps,
    "quotes",
  );
  const balances: Record<string, Awaited<ReturnType<typeof getAccountBalanceInfo>> | null> = {};
  const accounts = [...new Set(quotes.map((row) => row.partyA.toLowerCase()))];
  for (let offset = 0; offset < accounts.length; offset += 8)
    await Promise.all(
      accounts.slice(offset, offset + 8).map(async (account) => {
        balances[account] = await readOptional(
          () => getAccountBalanceInfo(config, { chainId: parameters.chainId, account: account as Address }),
          gaps,
          "accountBalance",
          account,
        );
      }),
    );
  return calculatePoolOpenPositions({
    quotes,
    balances,
    priceUsd: parameters.priceUsd,
    allowQuoteLockEstimate: parameters.allowQuoteLockEstimate,
    complete: !gaps.some((gap) => gap.source === "quotes"),
    gaps,
  });
}
