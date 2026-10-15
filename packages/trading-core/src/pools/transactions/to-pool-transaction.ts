import { toListingValue } from "../markets/to-listing-market";
import {
  PoolTransactionStatus,
  PoolTransactionType,
  type ListingDepositChainId,
  type PoolTransaction,
  type PoolTransactionPage,
} from "../types";
import type { MarketTransaction, MarketTransactionsHistory } from "../types/generated/listing-backend";

/**
 * Map one raw transaction row into the SDK's {@link PoolTransaction}.
 *
 * The row's own `token_address` / `chain_id` become `tokenAddress` / `chainId`,
 * so the row stays attributable on a page that spans every pool. The wire
 * `chain_id` is a plain number, read as the matching {@link ListingDepositChainId}.
 *
 * @param raw - One row of the backend's transaction-history response.
 * @returns The normalized transaction.
 */
export function toPoolTransaction(raw: MarketTransaction): PoolTransaction {
  return {
    transactionId: raw.transaction_id,
    tokenAddress: raw.token_address,
    chainId: raw.chain_id as ListingDepositChainId,
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
 * The envelope's `market_address` is `null` on a page that spans every pool; an
 * absent one is read the same way.
 *
 * @param raw - The response body.
 * @returns The normalized page.
 */
export function toPoolTransactionPage(raw: MarketTransactionsHistory): PoolTransactionPage {
  return {
    count: raw.count,
    marketAddress: raw.market_address ?? null,
    items: (raw.data ?? []).map(toPoolTransaction),
  };
}
