import { decodeErrorResult, type Abi, type DecodeErrorResultReturnType, type Hex } from "viem";
import { gaslessRevertText, parseGaslessErrorDetail } from "./errors";
import { isGaslessFreeQuotaExhaustedError } from "./get-gasless-fee-quote/fee-quote-errors";
import { classifyGaslessHttpStatus } from "./http";
import { getGaslessUnconfirmedSubmit, isGaslessIdempotencyConflictError } from "./unconfirmed-submit";

/**
 * Why a gasless action failed, in terms of what a UI can do about it.
 *
 * Deliberately coarser than the vendor's codes and finer than the HTTP status:
 * `INSUFFICIENT_ALLOWANCE` and an `OperationalFee: Allowance exceeded` revert
 * are the same problem with two wire shapes, while a `404` for an unknown
 * instance and a `404` for an unknown request id are not the same problem at
 * all.
 *
 * - `"payer-balance"` — the billing account cannot cover the fee. Top up its
 *   SYMMIO collateral; raising the allowance alone does nothing.
 * - `"fee-allowance"` — the payer's operational-fee allowance is too low.
 *   Approve more with `approveOperationalFee`, then re-read.
 * - `"free-quota"` — the daily free-operations quota is spent and the
 *   deployment refuses paid ones. Wait for the UTC reset or use the wallet.
 * - `"fee-limit"` — the fee policy refused the request for any other reason.
 * - `"failed-operation"` — one entry of the batch reverted; decode it with
 *   {@link decodeGaslessOperationFailure} to name the real cause.
 * - `"nonce-or-deadline"` — the signature is stale. Refresh the nonce and
 *   deadline and ask for a new one; never resend the old payload.
 * - `"deposit-below-minimum"` — the deposit address holds less than the
 *   settlement minimum, or the funds are not visible yet.
 * - `"deposit-not-above-fees"` — the balance clears the minimum but not the
 *   deposit and wallet-creation fees.
 * - `"idempotency-conflict"` — the key belongs to another workflow; mint a new one.
 * - `"client-schema"` — a `422`: the payload's shape is wrong. A client bug.
 * - `"rate-limited"` / `"unauthorized"` / `"forbidden"` / `"unknown-instance"` /
 *   `"gateway-unavailable"` — the gateway answered, before any service saw it.
 * - `"submit-unconfirmed"` — the outcome is unknown and the request may be
 *   executing. Replay it with `resubmitGaslessRequest`; never re-run the intent.
 * - `"simulation-reverted"` — the service simulated the batch and it reverted
 *   for a reason none of the above explains. Rebuild and re-sign.
 * - `"unknown"` — nothing classified it.
 */
export type GaslessFailureReason =
  | "payer-balance"
  | "fee-allowance"
  | "free-quota"
  | "fee-limit"
  | "failed-operation"
  | "nonce-or-deadline"
  | "deposit-below-minimum"
  | "deposit-not-above-fees"
  | "idempotency-conflict"
  | "client-schema"
  | "rate-limited"
  | "unauthorized"
  | "forbidden"
  | "unknown-instance"
  | "gateway-unavailable"
  | "submit-unconfirmed"
  | "simulation-reverted"
  | "unknown";

/**
 * Map a revert the service decoded onto a reason, when one of the contract's
 * own error names or require-strings is unambiguous about the cause.
 *
 * The error names come from the perps-core 0.8.6 GaslessLayer and InstantLayer
 * ABIs. The `"OperationalFee: …"` strings are not theirs — they are SymmioCore's
 * own `LibOperationalFee` require messages, raised when the GaslessLayer charges
 * the payer (the same ones `approveOperationalFee` documents), and they reach the
 * SDK through the service's simulation of the batch.
 */
function reasonFromRevert(text: string): GaslessFailureReason | null {
  if (text.includes("DailyFreeOpsLimitExceeded")) return "free-quota";
  if (text.includes("OperationalFee: Insufficient balance")) return "payer-balance";
  if (text.includes("OperationalFee: Allowance") || text.includes("OperationalFee: Insufficient allowance")) {
    return "fee-allowance";
  }
  if (text.includes("FeeLimitExceeded") || text.includes("OperationalFee:")) return "fee-limit";
  if (text.includes("DepositAmountBelowMinimum")) return "deposit-below-minimum";
  if (text.includes("DepositAmountNotAboveFees") || text.includes("MinimumDepositNotAboveFee")) {
    return "deposit-not-above-fees";
  }
  if (
    text.includes("InvalidNonce") ||
    text.includes("DeadlineExpired") ||
    text.includes("WalletOperationExpired") ||
    text.includes("WalletOperationInvalidNonce") ||
    text.includes("NativeGasTopUpNonceMismatch")
  ) {
    return "nonce-or-deadline";
  }
  return null;
}

/** Map a vendor `detail.code` onto a reason, where the code alone decides. */
function reasonFromVendorCode(code: string | null): GaslessFailureReason | null {
  switch (code) {
    case "IDEMPOTENCY_KEY_CONFLICT":
      return "idempotency-conflict";
    case "INSUFFICIENT_ALLOWANCE":
      return "fee-allowance";
    case "FEE_POLICY_WOULD_REVERT":
      return "fee-limit";
    case "DEPOSIT_BELOW_MINIMUM":
      return "deposit-below-minimum";
    default:
      return null;
  }
}

/** Map the gateway's own answer onto a reason. */
function reasonFromHttpStatus(err: unknown): GaslessFailureReason | null {
  switch (classifyGaslessHttpStatus(err)) {
    case "rate-limited":
      return "rate-limited";
    case "unauthorized":
      return "unauthorized";
    case "forbidden":
      return "forbidden";
    case "unknown-instance":
    case "selector-conflict":
      return "unknown-instance";
    case "client-schema":
      return "client-schema";
    case "gateway-not-ready":
    case "ambiguous":
      return "gateway-unavailable";
    default:
      return null;
  }
}

/**
 * Classify any gasless failure into the one reason a UI should act on.
 *
 * The order is deliberate: what the request *did* (unconfirmed, conflicting)
 * outranks what the service *said*, which outranks what the gateway answered —
 * a `400 SIMULATION_REVERTED` whose revert names an allowance shortfall is an
 * allowance problem, not a "bad request".
 *
 * Works on the error a framework layer re-wrapped too, so a React hook's
 * `SymmioRequestError` classifies exactly like the `SymmApiError` under it.
 *
 * @param err - Anything caught from a gasless action, or a polled record error.
 * @returns The reason, or `"unknown"` when nothing identifies it.
 *
 * @example
 * ```ts
 * switch (classifyGaslessFailure(err)) {
 *   case "fee-allowance":
 *     return showApproveOperationalFee();
 *   case "submit-unconfirmed":
 *     return showReconcilePending(getGaslessUnconfirmedSubmit(err));
 *   default:
 *     return showDiagnostics(parseGaslessErrorDetail(err));
 * }
 * ```
 */
export function classifyGaslessFailure(err: unknown): GaslessFailureReason {
  if (getGaslessUnconfirmedSubmit(err) !== null) return "submit-unconfirmed";
  if (isGaslessIdempotencyConflictError(err)) return "idempotency-conflict";
  /** Thrown by the fee pre-flight, before any HTTP call and with no vendor detail. */
  if (isGaslessFreeQuotaExhaustedError(err)) return "free-quota";

  const detail = parseGaslessErrorDetail(err);
  const fromRevert = reasonFromRevert(gaslessRevertText(detail));
  if (fromRevert) return fromRevert;
  if (detail?.failedOperation) return "failed-operation";

  const fromCode = reasonFromVendorCode(detail?.code ?? null);
  if (fromCode) return fromCode;

  const fromStatus = reasonFromHttpStatus(err);
  if (fromStatus) return fromStatus;

  return detail?.code === "SIMULATION_REVERTED" ? "simulation-reverted" : "unknown";
}

/**
 * The failing batch entry of an `OperationFailed` revert, with its inner revert
 * decoded against the ABI you supplied.
 */
export interface GaslessDecodedOperationFailure {
  /** Zero-based position of the failing operation in the submitted batch. */
  index: number;
  /** The inner revert data, exactly as the service reported it. */
  revertData: Hex;
  /** The decoded error, or `null` when the ABI does not describe it. */
  decoded: DecodeErrorResultReturnType | null;
}

/**
 * Identify the batch entry that reverted, and decode its inner revert.
 *
 * A relayed batch is atomic, so the InstantLayer reports an inner failure as
 * `OperationFailed(operationIndex, revertData)` — which names a position, not a
 * cause. Decoding `revertData` against the ABI of the contract that operation
 * targeted turns it back into the error the user can act on
 * (`InvalidNameLength`, `InsufficientBalance`, …).
 *
 * @param err - Anything caught from a gasless submit.
 * @param abi - ABI of the contract the failing operation targeted.
 * @returns The index, the raw revert data and the decoded error, or `null` when
 *   the failure was not an `OperationFailed`.
 *
 * @example
 * ```ts
 * const failure = decodeGaslessOperationFailure(err, accountLayerAbi);
 * if (failure) {
 *   console.error(`operation ${failure.index} reverted:`, failure.decoded?.errorName ?? failure.revertData);
 * }
 * ```
 */
export function decodeGaslessOperationFailure(err: unknown, abi: Abi): GaslessDecodedOperationFailure | null {
  const failed = parseGaslessErrorDetail(err)?.failedOperation;
  if (!failed) return null;

  let decoded: DecodeErrorResultReturnType | null = null;
  try {
    decoded = decodeErrorResult({ abi, data: failed.revertData });
  } catch {
    /** An ABI that does not describe this error is a caller mistake, not a reason to lose the index. */
    decoded = null;
  }
  return { index: failed.index, revertData: failed.revertData, decoded };
}
