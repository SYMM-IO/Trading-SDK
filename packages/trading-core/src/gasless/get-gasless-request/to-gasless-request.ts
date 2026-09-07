import type { Hash } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import { GaslessRequestStatus, type GaslessRequest } from "../types";
import type { GaslessWireRequestRecord } from "../wire-types";

const STATUS_VALUES = new Set<string>(Object.values(GaslessRequestStatus));

/**
 * Parse a wire status string into {@link GaslessRequestStatus}.
 *
 * @throws {SymmError} `GASLESS_STATUS_UNKNOWN` for a value outside the
 *   documented lifecycle — better a loud failure than a silent non-terminal
 *   status that polls forever.
 *
 * @internal
 */
export function toGaslessRequestStatus(raw: string): GaslessRequestStatus {
  if (!STATUS_VALUES.has(raw)) {
    throw new SymmError("api", "GASLESS_STATUS_UNKNOWN", `Gasless: unknown request status "${raw}".`);
  }
  return raw as GaslessRequestStatus;
}

/**
 * Normalize a stored request record (operations or deposits shape) into
 * {@link GaslessRequest}.
 *
 * The operations service keys its record `id`; the deposits service keys its
 * record `request_id` — both map onto `requestId`. Optional wire fields
 * normalize to explicit `null` (absent, not zero).
 *
 * @internal
 */
export function toGaslessRequest(raw: GaslessWireRequestRecord): GaslessRequest {
  const requestId = "id" in raw && typeof raw.id === "string" ? raw.id : (raw as { request_id: string }).request_id;
  const operationType = "operation_type" in raw ? (raw.operation_type ?? null) : null;

  return {
    requestId,
    status: toGaslessRequestStatus(raw.status),
    txHash: (raw.tx_hash as Hash | undefined) ?? null,
    errorCode: raw.error_code ?? null,
    errorMessage: raw.error_message ?? null,
    operationType,
    idempotencyKey: raw.idempotency_key ?? null,
  };
}
