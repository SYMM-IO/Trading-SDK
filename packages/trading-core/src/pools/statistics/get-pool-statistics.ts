import type { Config } from "../../core/config";
import { getMarketInfo } from "../../solvers/market-info/get-market-info";
import { getNotionalCapBySymbolId } from "../../solvers/notional-cap/get-notional-cap-by-symbol-id";
import { readOptional, readPages, type PoolReadGap } from "../composition";
import {
  getListingMarketDetail,
  type GetListingMarketDetailParameters,
} from "../market-detail/get-listing-market-detail";
import { getUserProfit } from "../profit/get-user-profit";
import { getPoolRewardChart } from "../rewards/get-pool-reward-chart";
import { getPoolTransactions } from "../transactions/get-pool-transactions";
import { PoolTransactionStatus, PoolTransactionType } from "../types";
import {
  calculatePoolStatistics,
  type CalculatePoolStatisticsParameters,
  type PoolStatistics,
} from "./calculate-pool-statistics";

/** Statistics identity and optional user scope. User scope requires authentication and a wallet cache scope. */
export type GetPoolStatisticsParameters = GetListingMarketDetailParameters & {
  priceUsd?: number;
  listing?: CalculatePoolStatisticsParameters["listing"];
  /** Existing ledger fraction and display-snapshot fallbacks; no additional reads. */
  shareFraction?: number | null;
  apy30dFallback?: bigint | null;
  buybackRatioFallback?: number | null;
} & (
    | { scope?: "pool"; accessToken?: never; userAddress?: never }
    | { scope: "user"; accessToken: string; userAddress: string }
  );
/** Result of getPoolStatistics. */
export type GetPoolStatisticsReturnType = PoolStatistics;

/** Read pool or personal statistics using shared listing and solver actions.
 * @param config - SDK configuration.
 * @param parameters - Pool identity and scope, plus an optional external price.
 * @returns Flat statistics and explicit source gaps.
 */
export async function getPoolStatistics(
  config: Config,
  parameters: GetPoolStatisticsParameters,
): Promise<PoolStatistics> {
  const gaps: PoolReadGap[] = [];
  const { chainId, tokenContractAddress, depositChain } = parameters;
  const [detail, pending, rewards, profit] = await Promise.all([
    readOptional(() => getListingMarketDetail(config, { chainId, tokenContractAddress, depositChain }), gaps, "detail"),
    parameters.scope === "user"
      ? null
      : readOptional(
          () =>
            readPages(
              async (start) => {
                const page = await getPoolTransactions(config, {
                  chainId,
                  tokenAddress: tokenContractAddress,
                  marketChainId: depositChain,
                  transactionType: PoolTransactionType.WITHDRAW,
                  transactionStatus: PoolTransactionStatus.PENDING,
                  start,
                  size: 50,
                });
                return { items: page.items, total: page.count };
              },
              (row) => row.transactionId,
              gaps,
              "pending",
            ),
          gaps,
          "pending",
        ),
    readOptional(
      () => getPoolRewardChart(config, { chainId, marketAddress: tokenContractAddress, marketChainId: depositChain }),
      gaps,
      "rewards",
    ),
    parameters.scope === "user"
      ? readOptional(
          () => getUserProfit(config, { chainId, tokenContractAddress, accessToken: parameters.accessToken }),
          gaps,
          "profit",
        )
      : null,
  ]);
  const [notionalCap, marketInfo] =
    detail?.symbolId == null
      ? [null, null]
      : await Promise.all([
          readOptional(
            () => getNotionalCapBySymbolId(config, { chainId, symbolId: detail.symbolId! }),
            gaps,
            "notionalCap",
          ),
          readOptional(() => getMarketInfo(config, { chainId }), gaps, "marketInfo"),
        ]);
  return calculatePoolStatistics({
    ...parameters,
    detail,
    pending: gaps.some((gap) => gap.source === "pending") ? null : pending,
    rewards,
    profit,
    notionalCap,
    marketInfo,
    gaps,
  });
}
