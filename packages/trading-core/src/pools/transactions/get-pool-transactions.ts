import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, PoolTransactionPage, PoolTransactionStatus, PoolTransactionType } from "../types";
import {
  getTransactionHistoryV2MarketTransactionHistoryStartSizeGet,
  type SupportedDepositChains,
  type TransactionType,
  type UserReadableTransactionStatus,
} from "../types/generated/listing-backend";
import { toPoolTransactionPage } from "./to-pool-transaction";

/**
 * Parameters for {@link getPoolTransactions}.
 *
 * Every filter is optional and they combine; with none, the page spans **every**
 * pool. `chainId` is the SDK's own — it selects which deployment's listing
 * backend to ask — and is unrelated to `marketChainId`, the chain a pool's token
 * lives on.
 */
export type GetPoolTransactionsParameters = Compute<
  ChainIdParameter & {
    /**
     * Narrow to one pool by its token contract address —
     * `ListingMarket.contractAddress`. Omit for every pool. EVM addresses match
     * case-insensitively; Solana base58 addresses are case-sensitive. An address
     * with no listed market fails with HTTP 400 (`Market not found`) rather than
     * returning an empty page.
     */
    tokenAddress?: string;
    /**
     * The pool's token contract address, under its old name.
     *
     * @deprecated Pass `tokenAddress`. Sent as the same filter; `tokenAddress`
     *   wins when both are set.
     */
    marketAddress?: string;
    /**
     * Narrow to pools whose token lives on this chain — `ListingMarket.chainId`.
     * The service rejects a chain outside its supported deposit chains
     * (`getListingConfig`) with HTTP 422.
     */
    marketChainId?: ListingDepositChainId;
    /** Narrow to one wallet's rows. Omit for every LP's. */
    walletAddress?: string;
    /** Narrow to deposits or withdrawals only. Omit for both. */
    transactionType?: PoolTransactionType;
    /** Narrow to one lifecycle status (e.g. only `REFUND`). Omit for all statuses. */
    transactionStatus?: PoolTransactionStatus;
    /** Row offset. @default 0 */
    start?: number;
    /**
     * Page size. The backend caps it at 50 and rejects a larger value with
     * HTTP 422.
     *
     * @default 50
     */
    size?: number;
  }
>;

/** Return type of {@link getPoolTransactions}: one page of transaction rows. */
export type GetPoolTransactionsReturnType = PoolTransactionPage;

/**
 * Fetch pool deposit and withdrawal history — refunded deposits included —
 * newest first.
 *
 * Public and unscoped by default: every LP's rows on **every** pool, in one
 * newest-first sequence. Narrow it with `tokenAddress` (one pool),
 * `marketChainId`, `walletAddress`, `transactionType` and `transactionStatus`;
 * the filters combine. Each row names its own pool (`tokenAddress`, `chainId`),
 * so an all-pools page stays attributable.
 *
 * The service fixes the order — newest first — and takes no sort parameter.
 * Pagination is path-based (`/{start}/{size}`), and `count` is the total across
 * all pages, so it is what a pager should divide, not `items.length`. A `start`
 * past `count` returns an empty page.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters and paging.
 * @returns One {@link PoolTransactionPage}.
 * @throws {SymmApiError} when the endpoint request fails — including HTTP 400
 *   for a `tokenAddress` with no listed market, and HTTP 422 for an invalid
 *   filter value or a `size` above 50.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing backend.
 *
 * @example
 * ```ts
 * // The latest activity across every pool.
 * const latest = await getPoolTransactions(config);
 *
 * // One pool's pending withdrawals.
 * const pending = await getPoolTransactions(config, {
 *   tokenAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
 *   transactionType: PoolTransactionType.WITHDRAW,
 *   transactionStatus: PoolTransactionStatus.PENDING,
 * });
 * ```
 */
export async function getPoolTransactions(
  config: Config,
  parameters: GetPoolTransactionsParameters = {},
): Promise<GetPoolTransactionsReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  const { start = 0, size = 50 } = parameters;
  /**
   * The deprecated `marketAddress` goes out as `token_address` as well, so it
   * keeps filtering if the service retires its `market_address` alias — an
   * unknown query param is silently ignored, which would return every pool.
   */
  const tokenAddress = parameters.tokenAddress ?? parameters.marketAddress;

  try {
    const response = await getTransactionHistoryV2MarketTransactionHistoryStartSizeGet(
      start,
      size,
      /**
       * Axios drops `undefined` params when it serializes the query, so an
       * omitted filter sends no key. The casts only re-label the SDK's enums as
       * the generated ones; the values go out unchanged.
       */
      {
        token_address: tokenAddress,
        chain_id: parameters.marketChainId as SupportedDepositChains | undefined,
        wallet_address: parameters.walletAddress,
        transaction_type: parameters.transactionType as TransactionType | undefined,
        transaction_status: parameters.transactionStatus as UserReadableTransactionStatus | undefined,
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
