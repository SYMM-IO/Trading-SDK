import { toListingValue } from "../markets/to-listing-market";
import {
  type ListingDepositChainId,
  type PoolTransactionStatus,
  type PoolTransactionType,
  type UserTransaction,
  type UserTransactionPage,
} from "../types";
import type { SearchUserTransactionsResult, UserTransactionItem } from "../types/generated/listing-backend";

/**
 * Map one raw user-transaction row into the SDK's {@link UserTransaction}.
 *
 * `amount` is a 1e18-scaled integer string like the rest of the listing money
 * fields, parsed to a `bigint` at `LISTING_VALUE_DECIMALS` with
 * {@link toListingValue} (absent → `0n`); `tokenDecimals` is carried as metadata,
 * not as the amount's scale. The generated `transaction_type` /
 * `transaction_status` / `chain_id` enums share their string/number values with
 * the SDK's {@link PoolTransactionType} / {@link PoolTransactionStatus} /
 * {@link ListingDepositChainId}, so the casts are value-preserving.
 *
 * @param raw - One row of the user-transactions response.
 * @returns The normalized transaction.
 */
export function toUserTransaction(raw: UserTransactionItem): UserTransaction {
  return {
    transactionId: raw.transaction_id,
    type: raw.transaction_type as unknown as PoolTransactionType,
    status: raw.transaction_status as unknown as PoolTransactionStatus,
    amount: toListingValue(raw.amount) ?? 0n,
    tokenDecimals: raw.token_decimal,
    tokenAddress: raw.token_address,
    tokenName: raw.token_name,
    tokenTicker: raw.token_ticker,
    chainId: raw.chain_id as unknown as ListingDepositChainId,
    wallet: raw.wallet ?? null,
    refundAddress: raw.refund_address ?? null,
    transactionHash: raw.transaction_hash ?? null,
    time: raw.create_time ?? null,
  };
}

/**
 * Map the user-transactions envelope into a {@link UserTransactionPage}.
 *
 * @param raw - The response body.
 * @returns The normalized page. `count` is the total across all pages.
 */
export function toUserTransactionPage(raw: SearchUserTransactionsResult): UserTransactionPage {
  return {
    count: raw.count,
    items: (raw.items ?? []).map(toUserTransaction),
  };
}
