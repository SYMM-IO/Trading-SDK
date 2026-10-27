import type { Config } from "../../core/config";
import { readOptional, readPages, type PoolReadGap } from "../composition";
import {
  getListingMarketDetail,
  type GetListingMarketDetailParameters,
} from "../market-detail/get-listing-market-detail";
import { getUserProfit } from "../profit/get-user-profit";
import { PoolTransactionType } from "../types";
import { getUserTransactions } from "../user-transactions/get-user-transactions";
import { calculatePoolPosition, type PoolPositionData } from "./calculate-pool-position";

/** Identity, authenticated wallet cache scope, and optional externally supplied token price. */
export type GetPoolPositionParameters = GetListingMarketDetailParameters & {
  accessToken: string;
  userAddress: string;
  priceUsd?: number;
  /** Optional integer percentage (0–100) for the position's exact withdrawal preview. */
  withdrawalPercent?: number;
  /** Existing catalog LP-ledger ownership, in whole percent. No extra catalog request is made. */
  userSharePercentage?: number | null;
};
/** Result of getPoolPosition. */
export type GetPoolPositionReturnType = PoolPositionData;

/** Read one stake with bounded deposit history; unavailable sources appear in gaps.
 * @param config - SDK deployment config.
 * @param parameters - Pool identity, authenticated user and optional USD price.
 * @returns A flat position with exact amounts and source gaps.
 */
export async function getPoolPosition(
  config: Config,
  parameters: GetPoolPositionParameters,
): Promise<GetPoolPositionReturnType> {
  const gaps: PoolReadGap[] = [];
  const { chainId, tokenContractAddress, depositChain, accessToken } = parameters;
  const [detail, profit, deposits] = await Promise.all([
    readOptional(
      () => getListingMarketDetail(config, { chainId, tokenContractAddress, depositChain }),
      gaps,
      "detail",
      tokenContractAddress,
    ),
    readOptional(
      () => getUserProfit(config, { chainId, tokenContractAddress, accessToken }),
      gaps,
      "profit",
      tokenContractAddress,
    ),
    readOptional(
      () =>
        readPages(
          async (start) => {
            const page = await getUserTransactions(config, {
              chainId,
              accessToken,
              tokenAddress: tokenContractAddress,
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
      tokenContractAddress,
    ),
  ]);
  return calculatePoolPosition({
    ...parameters,
    detail,
    profit,
    deposits,
    depositsComplete: !gaps.some((gap) => gap.source === "deposits"),
    gaps,
  });
}
