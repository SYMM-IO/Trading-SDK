import type { Address } from "viem";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessSubmitReceipt } from "./types";
import { toGaslessAcceptanceStatus, toGaslessOptionalAmount } from "./wire-parse";
import type { GaslessWireOperationAccepted } from "./wire-types";

/**
 * What the submitter knows about a relay the acceptance body does not echo: the
 * identity it was submitted under and the deployment it went to.
 *
 * @internal
 */
export interface GaslessSubmitContext {
  /** The `userAddress` the request is tracked under. */
  owner: Address;
  /** The wallet ids sent with the batch, in `signedOps` order. */
  walletIds: readonly bigint[];
  /** The idempotency key the request was submitted with. */
  idempotencyKey: string;
  /** The protocol instance the submit was routed to, or `null` for a proxy base that names none. */
  protocolInstance: string | null;
}

/**
 * Parse an operation relay's `202` acceptance into {@link GaslessSubmitReceipt}.
 *
 * Deliberately tolerant everywhere but `request_id`: a `202` is the point of no
 * return, and the id is the only handle on a workflow that may already be
 * executing. So a missing or unknown `status` reads as `queued` and an absent
 * or malformed amount reads as `null`, rather than throwing away the id with
 * the rest of the body.
 *
 * @param raw - The acceptance body.
 * @param context - What the submitter knows that the body does not echo.
 * @returns The normalized receipt.
 * @throws {SymmError} `GASLESS_ACCEPTANCE_INVALID` when the body carries no `request_id` —
 *   nothing is left to track, so the submit must be treated as unconfirmed.
 *
 * @internal
 */
export function toGaslessSubmitReceipt(
  raw: GaslessWireOperationAccepted,
  context: GaslessSubmitContext,
): GaslessSubmitReceipt {
  return {
    requestId: requireGaslessRequestId(raw?.request_id),
    status: toGaslessAcceptanceStatus(raw.status),
    paidFee: toGaslessOptionalAmount(raw.paid_fee),
    remainingFeeAllowance: toGaslessOptionalAmount(raw.remaining_fee_allowance),
    idempotencyKey: context.idempotencyKey,
    protocolInstance: context.protocolInstance,
    owner: context.owner,
    walletIds: context.walletIds,
  };
}

/**
 * The one field an acceptance must carry. Everything else about a `202` is
 * advisory; without the id there is nothing to poll, resume or reconcile.
 *
 * @internal
 */
export function requireGaslessRequestId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new SymmError(
      "api",
      "GASLESS_ACCEPTANCE_INVALID",
      "Gasless: the service accepted the submit without a request_id, so the workflow cannot be tracked. Resend the byte-identical request under the same idempotency key to recover the record.",
    );
  }
  return value;
}

/**
 * Whether an error is the `GASLESS_ACCEPTANCE_INVALID` that
 * {@link requireGaslessRequestId} throws — a submit the service **did** accept
 * with a `202`, whose body carried no `request_id`.
 *
 * It is not a rejection: the batch exists server-side and whatever it signed
 * will be consumed, so callers that track side effects of an accepted submit
 * must treat it as acceptance, not as failure.
 *
 * @param err - Anything caught from a gasless submit.
 * @returns `true` for that error only.
 *
 * @internal
 */
export function isGaslessAcceptanceInvalidError(err: unknown): boolean {
  return err instanceof SymmError && err.code === "GASLESS_ACCEPTANCE_INVALID";
}
