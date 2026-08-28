import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { PoolTransactionPage } from "../types";
import { getTransactionHistoryV2MarketTransactionHistoryStartSizeGet } from "../types/generated/listing-backend";
import { toPoolTransactionPage } from "./to-pool-transaction";

/**
 * Parameters for {@link getPoolTransactions}.
 */
export type GetPoolTransactionsParameters = Compute<
  ChainIdParameter & {
    /** The pool's token contract address. */
    marketAddress: string;
    /**
     * Narrow the page to one wallet's rows. Omit for the pool's whole deposit
     * and withdrawal history across every LP.
     */
    walletAddress?: string;
    /** Row offset. @default 0 */
    start?: number;
    /** Page size. @default 150 */
    size?: number;
  }
>;

/** Return type of {@link getPoolTransactions}: one page of transaction rows. */
export type GetPoolTransactionsReturnType = PoolTransactionPage;

/**
 * Fetch a pool's deposit and withdrawal history, newest first — refunded
 * deposits included.
 *
 * Public and pool-wide by default: every LP's rows, not just the caller's. Pass
 * `walletAddress` to narrow it to one wallet.
 *
 * Pagination is path-based (`/{start}/{size}`), and `count` is the total across
 * all pages — so it is what a pager should divide, not `items.length`.
 *
 * @param config - The SDK config.
 * @param parameters - The pool address, optional wallet filter, and paging.
 * @returns One {@link PoolTransactionPage}.
 * @throws {SymmApiError} when the endpoint request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing backend.
 *
 * @example
 * ```ts
 * const page = await getPoolTransactions(config, {
 *   marketAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
 *   size: 50,
 * });
 * ```
 */
export async function getPoolTransactions(
  config: Config,
  parameters: GetPoolTransactionsParameters,
): Promise<GetPoolTransactionsReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  const { start = 0, size = 150 } = parameters;

  try {
    const response = await getTransactionHistoryV2MarketTransactionHistoryStartSizeGet(
      start,
      size,
      {
        market_address: parameters.marketAddress,
        ...(parameters.walletAddress === undefined ? {} : { wallet_address: parameters.walletAddress }),
      },
      { baseURL },
    );

    return toPoolTransactionPage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_POOL_TRANSACTIONS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_POOL_TRANSACTIONS_FAILED",
      `Failed to fetch pool transactions: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
