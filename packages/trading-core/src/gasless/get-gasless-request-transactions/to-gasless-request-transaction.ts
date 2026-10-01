import type { Hash } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import { GaslessTransactionAttemptStatus, type GaslessRequestTransaction } from "../types";
import type { GaslessWireTransactionAttempt } from "../wire-types";

const ATTEMPT_STATUS_VALUES = new Set<string>(Object.values(GaslessTransactionAttemptStatus));

/**
 * Parse a wire attempt status into {@link GaslessTransactionAttemptStatus}.
 *
 * @throws {SymmError} `GASLESS_ATTEMPT_STATUS_UNKNOWN` for a value outside the
 *   documented set — the same loud-failure rule the request-status parser
 *   follows, so a silently mistyped attempt never renders as a confirmed one.
 *
 * @internal
 */
export function toGaslessTransactionAttemptStatus(raw: string): GaslessTransactionAttemptStatus {
  if (!ATTEMPT_STATUS_VALUES.has(raw)) {
    throw new SymmError(
      "api",
      "GASLESS_ATTEMPT_STATUS_UNKNOWN",
      `Gasless: unknown transaction attempt status "${raw}".`,
    );
  }
  return raw as GaslessTransactionAttemptStatus;
}

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
    status: toGaslessTransactionAttemptStatus(raw.status),
    requestId: raw.entity_id,
    workflow: raw.workflow,
    receipt: raw.receipt ?? null,
    errorCode: raw.error_code ?? null,
    errorMessage: raw.error_message ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}
