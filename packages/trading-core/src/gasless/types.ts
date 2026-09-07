import type { Hash } from "viem";

/**
 * Lifecycle status of a GaslessQ relayer request.
 *
 * A request moves `QUEUED → SUBMITTED → SUCCEEDED | REVERTED | FAILED`, or
 * `QUEUED → REJECTED` when the worker's pre-broadcast re-check refuses it.
 *
 * `SUBMITTED` is **not** success — it only means a transaction hash exists.
 * Only `SUCCEEDED` is success.
 */
export enum GaslessRequestStatus {
  /** Accepted by the service; no transaction broadcast yet. */
  QUEUED = "queued",
  /** A transaction was broadcast and `txHash` is stored; the receipt is pending. */
  SUBMITTED = "submitted",
  /** The relayed transaction mined with `status = 1`. */
  SUCCEEDED = "succeeded",
  /** The relayed transaction mined with `status = 0`; all charges rolled back. */
  REVERTED = "reverted",
  /** A service or RPC failure occurred before a successful receipt. */
  FAILED = "failed",
  /** The worker's re-check rejected the request before any broadcast. */
  REJECTED = "rejected",
}

/**
 * The terminal {@link GaslessRequestStatus} values — polling stops here.
 *
 * @example
 * ```ts
 * refetchInterval: (query) => {
 *   const status = query.state.data?.status;
 *   return status && isGaslessRequestTerminal(status) ? false : 1_500;
 * }
 * ```
 */
export const GASLESS_TERMINAL_STATUSES: ReadonlySet<GaslessRequestStatus> = new Set([
  GaslessRequestStatus.SUCCEEDED,
  GaslessRequestStatus.REVERTED,
  GaslessRequestStatus.FAILED,
  GaslessRequestStatus.REJECTED,
]);

/**
 * Whether a {@link GaslessRequestStatus} is terminal (no further polling needed).
 *
 * @param status - The status to check.
 * @returns `true` for `succeeded`, `reverted`, `failed`, and `rejected`.
 */
export function isGaslessRequestTerminal(status: GaslessRequestStatus): boolean {
  return GASLESS_TERMINAL_STATUSES.has(status);
}

/** Default poll cadence while a request is `queued` (service-recommended 1–2 s). */
export const GASLESS_QUEUED_POLL_MS = 1_500;
/** Default poll cadence after a request is `submitted` (service-recommended 3–5 s). */
export const GASLESS_SUBMITTED_POLL_MS = 3_000;

/**
 * The poll cadence a request's current status calls for, or `false` once it is
 * terminal.
 *
 * Shared by the imperative wait loop and the query factory's `refetchInterval`
 * default so both follow one cadence. Terminal records are immutable, so
 * stopping is not an optimisation — a poll that never stops bills the service
 * forever for an answer that cannot change.
 *
 * @param status - The last known status, or `undefined` before the first fetch.
 * @returns Milliseconds until the next poll, or `false` when terminal.
 */
export function gaslessPollDelay(status: GaslessRequestStatus | undefined): number | false {
  if (status && isGaslessRequestTerminal(status)) return false;
  return status === GaslessRequestStatus.SUBMITTED ? GASLESS_SUBMITTED_POLL_MS : GASLESS_QUEUED_POLL_MS;
}

/**
 * Which GaslessQ sub-service a request id belongs to. Operations and deposit
 * settlements are stored by different services with different poll URLs, so a
 * request id alone does not identify a workflow — keep the service with it.
 */
export type GaslessService = "operations" | "deposits";

/**
 * One stored relayer request, normalized from the service's snake_case record.
 *
 * Raw decimal-string amounts are parsed to `bigint`; addresses come back
 * lowercased by the service, so compare case-insensitively.
 */
export interface GaslessRequest {
  /** Stable service tracking id — persist it to resume polling after a reload. */
  requestId: string;
  /** Current lifecycle status. */
  status: GaslessRequestStatus;
  /** Broadcast transaction hash, once the worker has submitted one. */
  txHash: Hash | null;
  /** Vendor error code on `rejected` / `reverted` / `failed`, when stored. */
  errorCode: string | null;
  /** Human-readable error message, when stored. */
  errorMessage: string | null;
  /** The workflow label the submitter attached (`operationType`). */
  operationType: string | null;
  /** Idempotency key the request was submitted with, when stored. */
  idempotencyKey: string | null;
}

/**
 * The HTTP 202 acknowledgement returned by an operation relay submit.
 *
 * `paidFee` is the total collateral charge quoted for the request;
 * `remainingFeeAllowance` is the payer's remaining operational-fee allowance
 * after considering it. Both are raw collateral amounts.
 */
export interface GaslessSubmitReceipt {
  /** Stable service tracking id. Persist it immediately. */
  requestId: string;
  /** Status at acceptance — normally {@link GaslessRequestStatus.QUEUED}. */
  status: GaslessRequestStatus;
  /** Total collateral fee quoted for the request (raw units). */
  paidFee: bigint;
  /** Remaining operational-fee allowance after `paidFee` (raw units). */
  remainingFeeAllowance: bigint;
}

/**
 * One EVM broadcast attempt stored for a relayer request, with its receipt
 * outcome when observed.
 */
export interface GaslessRequestTransaction {
  /** Attempt row id. */
  id: string;
  /** Transaction hash of this attempt. */
  txHash: Hash | null;
  /** 1-based attempt number. */
  attemptNumber: number;
  /** Attempt outcome: `submitted`, `confirmed`, `reverted`, or `failed`. */
  status: string;
  /** Stored error code for a failed attempt, when present. */
  errorCode: string | null;
  /** Stored error message for a failed attempt, when present. */
  errorMessage: string | null;
}

/**
 * Lifecycle event emitted by the transparent gasless execution mode (the
 * `execution.onEvent` observer on {@link SymmioGaslessConfig}).
 *
 * `accepted` fires as soon as the service returns a request id — persist
 * `{ requestId, service, protocolInstance, chainId }` there so an in-flight
 * workflow survives a reload (there is no list-by-wallet endpoint).
 * `broadcast` fires when a transaction hash appears, and `terminal` when the
 * request reaches a terminal status.
 */
export type GaslessRelayEvent =
  | {
      type: "accepted";
      requestId: string;
      service: GaslessService;
      chainId: number;
      /** Protocol-instance key the request was accepted on (empty for proxy bases that hide it). */
      protocolInstance: string;
      operationType: string;
      idempotencyKey: string;
    }
  | { type: "broadcast"; requestId: string; txHash: Hash; chainId: number }
  | {
      type: "terminal";
      requestId: string;
      status: GaslessRequestStatus;
      txHash: Hash | null;
      chainId: number;
    };

/**
 * The HTTP 202 acknowledgement returned by a deposit settlement submit —
 * richer than the operations receipt: it echoes the swept deposit address and
 * the amounts observed, charged, and credited (raw collateral units).
 */
export interface GaslessDepositSubmitReceipt {
  /** Stable service tracking id (poll it with `service: "deposits"`). */
  requestId: string;
  /** Status at acceptance — normally {@link GaslessRequestStatus.QUEUED}. */
  status: GaslessRequestStatus;
  /** The deterministic deposit address being swept. */
  depositAddress: string;
  /** Collateral balance the service observed at the deposit address. */
  observedAmount: bigint;
  /** Flat fee deducted from the observed amount. */
  paidFee: bigint;
  /** Net amount credited to the sub-account. */
  creditedAmount: bigint;
}
