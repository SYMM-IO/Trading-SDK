import type { Hash } from "viem";
import type { GaslessRequestTransaction } from "../types";
import type { GaslessWireTransactionAttempt } from "../wire-types";

/**
 * Normalize one stored EVM broadcast attempt into
 * {@link GaslessRequestTransaction}. Optional wire fields normalize to
 * explicit `null`.
 *
 * @internal
 */
export function toGaslessRequestTransaction(raw: GaslessWireTransactionAttempt): GaslessRequestTransaction {
  return {
    id: raw.id,
    txHash: (raw.tx_hash as Hash | undefined) ?? null,
    attemptNumber: raw.attempt_number,
    status: raw.status,
    errorCode: raw.error_code ?? null,
    errorMessage: raw.error_message ?? null,
  };
}
