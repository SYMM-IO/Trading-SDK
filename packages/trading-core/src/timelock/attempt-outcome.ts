import { UserRejectedRequestError } from "viem";
import { parseGaslessErrorDetail } from "../gasless/errors";

const DEFINITE_APPROVAL_REJECTIONS = new Map<number, ReadonlySet<number>>([
  [400, new Set([3700, 3701, 3702, 3703, 3704, 3710])],
  [403, new Set([3709])],
  [429, new Set([3705])],
]);

function records(error: unknown): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < 12 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    result.push(record);
    current = record.cause;
  }
  return result;
}

/**
 * Find a submitted transaction hash retained anywhere in an SDK error chain.
 *
 * @param error - An SDK, viem, wallet, or relayer error.
 * @returns The first valid transaction hash, or `undefined` when submission is not evidenced.
 */
export function getTimelockRecoveryTransactionHash(error: unknown): string | undefined {
  for (const record of records(error)) {
    for (const key of ["hash", "transactionHash", "txHash", "broadcastHash"] as const) {
      const value = record[key];
      if (typeof value === "string" && /^0x[\da-fA-F]{64}$/.test(value)) return value;
    }
  }
  return undefined;
}

/**
 * Check whether an error retains evidence that a relay or transaction may have been submitted.
 *
 * @param error - An SDK, viem, wallet, or relayer error.
 * @returns `true` when a transaction hash, request ID, or idempotency key is present.
 * @remarks A positive result is deliberately conservative: reconcile the existing attempt before retrying.
 */
export function hasTimelockSubmissionEvidence(error: unknown): boolean {
  if (getTimelockRecoveryTransactionHash(error)) return true;
  for (const record of records(error)) {
    if (
      record.code === "GASLESS_SUBMIT_UNCONFIRMED" ||
      record.requestId ||
      record.request_id ||
      record.idempotencyKey ||
      record.idempotency_key
    )
      return true;
    const response = record.responseData;
    if (!response || typeof response !== "object") continue;
    const value = response as Record<string, unknown>;
    if (
      value.requestId ||
      value.request_id ||
      value.idempotencyKey ||
      value.idempotency_key ||
      value.transactionHash ||
      value.txHash ||
      value.broadcastHash
    )
      return true;
  }
  return false;
}

/**
 * Check whether the provider explicitly rejected an approval before issuing one.
 *
 * @param error - A normalized or raw timelock approval error.
 * @returns `true` only for documented, definitive provider rejection status/code pairs.
 */
export function isDefiniteTimelockApprovalRejection(error: unknown): boolean {
  for (const record of records(error)) {
    if (record.kind !== "api") continue;
    const details = record.timelock ?? record.details;
    if (!details || typeof details !== "object") continue;
    const knownCode = (details as Record<string, unknown>).knownCode;
    const code = typeof knownCode === "number" ? knownCode : Number(record.code);
    if (!Number.isSafeInteger(code)) continue;
    if (typeof record.status === "number") {
      if (DEFINITE_APPROVAL_REJECTIONS.get(record.status)?.has(code)) return true;
    } else if ([...DEFINITE_APPROVAL_REJECTIONS.values()].some((codes) => codes.has(code))) return true;
  }
  return false;
}

/**
 * Check whether the user definitely rejected before any relay or transaction was submitted.
 *
 * @param error - A normalized or raw wallet error.
 * @returns `true` only when rejection is explicit and no submission evidence exists.
 */
export function isUnsubmittedTimelockWalletRejection(error: unknown): boolean {
  if (hasTimelockSubmissionEvidence(error)) return false;
  return records(error).some((record) => record.kind === "user-rejected" || record instanceof UserRejectedRequestError);
}

/**
 * Check whether a gasless relay definitively rejected during simulation before submission.
 *
 * @param error - A normalized or raw gasless relay error.
 * @returns `true` only for HTTP 400 `SIMULATION_REVERTED` without submission evidence.
 */
export function isDefiniteGaslessSimulationRejection(error: unknown): boolean {
  if (hasTimelockSubmissionEvidence(error)) return false;
  return records(error).some(
    (record) => record.status === 400 && parseGaslessErrorDetail(record)?.code === "SIMULATION_REVERTED",
  );
}
