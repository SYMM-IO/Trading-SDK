import type { PoolRefundResult } from "../types";
import type { RefundResponseSchema } from "../types/generated/listing-backend";

/**
 * Map the `/v2/market/refund` response into the SDK's {@link PoolRefundResult}.
 *
 * @param response - The raw refund response body.
 * @returns The normalized refund receipt.
 */
export function toRefundResult(response: RefundResponseSchema): PoolRefundResult {
  return {
    transactionHash: response.tx_hash,
  };
}
