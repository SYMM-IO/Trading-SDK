import type { Address } from "viem";
import { toGaslessRequestStatus } from "./get-gasless-request/to-gasless-request";
import type { GaslessDepositSubmitReceipt } from "./types";
import type { GaslessWireDepositAccepted } from "./wire-types";

/**
 * Parse a deposit settlement's 202 acceptance into
 * {@link GaslessDepositSubmitReceipt}. Shared by the new-account and
 * existing-account settlement actions.
 *
 * @internal
 */
export function toGaslessDepositReceipt(raw: GaslessWireDepositAccepted): GaslessDepositSubmitReceipt {
  return {
    requestId: raw.request_id,
    status: toGaslessRequestStatus(raw.status),
    depositAddress: raw.deposit_address as Address,
    observedAmount: BigInt(raw.observed_amount),
    paidFee: BigInt(raw.paid_fee),
    creditedAmount: BigInt(raw.credited_amount),
  };
}
