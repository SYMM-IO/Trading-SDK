import type { RefundRequestSchema, SupportedDepositChains } from "../types/generated/listing-backend";
import type { RefundMarketParameters } from "./refund-market";

/**
 * Build the `/v2/market/refund` request body from {@link RefundMarketParameters}.
 *
 * `depositChain` is a {@link ListingDepositChainId}, whose numeric values match
 * the wire's `SupportedDepositChains`, so the cast is value-preserving.
 *
 * @param parameters - The refund inputs.
 * @returns The request body for `refundV2MarketRefundPost`.
 */
export function toRefundRequest(parameters: RefundMarketParameters): RefundRequestSchema {
  return {
    market_address: parameters.marketAddress,
    deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
    recipient_address: parameters.recipientAddress,
  };
}
