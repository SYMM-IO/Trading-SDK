import type { PoolCancelWithdrawResult } from "../types";
import type { CancelWithdrawResponse } from "../types/generated/listing-backend";

/**
 * Map the `/v2/market/withdraw/{id}` DELETE response into the SDK's
 * {@link PoolCancelWithdrawResult}.
 *
 * `transaction_status` is carried through as a plain string — the wire enum
 * (`canceled` | `pending` | `transferred` | …) is a superset of the SDK's
 * `PoolTransactionStatus`, so it is not narrowed to that enum.
 *
 * @param response - The raw DELETE response body.
 * @returns The normalized cancellation receipt.
 */
export function toCancelWithdrawResult(response: CancelWithdrawResponse): PoolCancelWithdrawResult {
  return {
    transactionId: response.transaction_id,
    status: response.transaction_status,
  };
}
