import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { PoolTransactionStatus, PoolTransactionType, UserTransactionPage } from "../types";
import {
  searchUserTransactionsV2MarketUserTransactionsStartSizeGet,
  type TransactionType,
  type UserReadableTransactionStatus,
} from "../types/generated/listing-backend";
import { toUserTransactionPage } from "./to-user-transaction";

/**
 * Parameters for {@link getUserTransactions}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — it only ever returns the signed-in user's own transactions, across
 * **every** pool — so the optional filters narrow within that set.
 */
export type GetUserTransactionsParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed
     * and returns only the authenticated user's transactions. Sent as the
     * `Authorization: Bearer <token>` header; a bad or expired token yields a
     * `401`.
     */
    accessToken: string;
    /** Narrow to deposits or withdrawals only. Omit for both. */
    transactionType?: PoolTransactionType;
    /** Narrow to one status (e.g. only pending). Omit for all statuses. */
    transactionStatus?: PoolTransactionStatus;
    /** Narrow to one pool's token contract address. Omit for every pool. */
    tokenAddress?: string;
    /** Row offset. @default 0 */
    start?: number;
    /** Page size. @default 150 */
    size?: number;
  }
>;

/** Return type of {@link getUserTransactions}: one page of the user's transactions. */
export type GetUserTransactionsReturnType = UserTransactionPage;

/**
 * Fetch the signed-in user's transaction history — their pool deposits and
 * withdrawals across **every** pool, newest first, refunded deposits included.
 *
 * Hits the authed `/v2/market/user-transactions/{start}/{size}` endpoint with the
 * caller's bearer token; it only ever returns transactions the user owns.
 * Optionally narrow by type, status, or pool. Pagination is path-based
 * (`/{start}/{size}`), and `count` is the total across all pages — so it is what
 * a pager should divide, not `items.length`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, optional type/status/pool filters, and paging.
 * @returns One {@link UserTransactionPage}.
 * @throws {SymmApiError} `FETCH_USER_TRANSACTIONS_FAILED` when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the history instead.
 *
 * @example
 * ```ts
 * const page = await getUserTransactions(config, {
 *   accessToken: token.accessToken,
 *   size: 25,
 * });
 * ```
 */
export async function getUserTransactions(
  config: Config,
  parameters: GetUserTransactionsParameters,
): Promise<GetUserTransactionsReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  const { start = 0, size = 150 } = parameters;

  try {
    const response = await searchUserTransactionsV2MarketUserTransactionsStartSizeGet(
      start,
      size,
      {
        ...(parameters.transactionType === undefined
          ? {}
          : { transaction_type: parameters.transactionType as unknown as TransactionType }),
        ...(parameters.transactionStatus === undefined
          ? {}
          : { transaction_status: parameters.transactionStatus as unknown as UserReadableTransactionStatus }),
        ...(parameters.tokenAddress === undefined ? {} : { token_address: parameters.tokenAddress }),
      },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );

    return toUserTransactionPage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_USER_TRANSACTIONS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_USER_TRANSACTIONS_FAILED",
      `Failed to fetch user transactions: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
