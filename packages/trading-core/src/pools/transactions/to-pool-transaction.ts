import { toListingValue } from "../markets/to-listing-market";
import { PoolTransactionStatus, PoolTransactionType, type PoolTransaction, type PoolTransactionPage } from "../types";
import type { MarketTransaction, MarketTransactionsHistory } from "../types/generated/listing-backend";

/**
 * Map one raw transaction row into the SDK's {@link PoolTransaction}.
 *
 * @param raw - One row of the backend's transaction-history response.
 * @returns The normalized transaction.
 */
export function toPoolTransaction(raw: MarketTransaction): PoolTransaction {
  return {
    transactionId: raw.transaction_id,
    walletAddress: raw.wallet_address,
    amount: toListingValue(raw.amount) ?? 0n,
    usdcAmount: toListingValue(raw.usdc_amount) ?? 0n,
    tokenAmount: toListingValue(raw.token_amount) ?? 0n,
    transactionHash: raw.transaction_hash ?? null,
    refundAddress: raw.refund_address ?? null,
    refundTransactionHash: raw.refund_transaction_hash ?? null,
    refundTime: raw.refund_time ?? null,
    type: raw.type as unknown as PoolTransactionType,
    status: raw.status as unknown as PoolTransactionStatus,
    time: raw.time,
  };
}

/**
 * Map the backend's transaction-history envelope into a
 * {@link PoolTransactionPage}.
 *
 * @param raw - The response body.
 * @returns The normalized page.
 */
export function toPoolTransactionPage(raw: MarketTransactionsHistory): PoolTransactionPage {
  return {
    marketAddress: raw.market_address,
    count: raw.count,
    items: (raw.data ?? []).map(toPoolTransaction),
  };
}
