import type {
  ConfigParameter,
  GaslessAcceptedRequest,
  GaslessConfirmation,
  GaslessConfirmedRequest,
  GaslessRequest,
  GaslessRequestStatus,
} from "@symmio/trading-core";
import type { Hash } from "viem";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Confirmation options shared by every explicit relay hook — the gasless
 * analogue of `WriteParameters`.
 *
 * A relayed submit returns a `202` in milliseconds while the transaction lands
 * seconds later, so a mutation that resolves on acceptance resolves before its
 * own effect exists. These options decide how far the hook follows the request
 * before calling it done.
 */
export interface GaslessRelayParameters extends ConfigParameter {
  /**
   * How far to confirm before resolving. Default `"receipt"`.
   *
   * `"receipt"` waits for the receipt on *this config's* client, which is what
   * makes the invalidation that follows truthful — refetching against a node
   * that has not seen the block re-reads pre-state. `"terminal"` trusts the
   * relayer's view; `"none"` restores fire-and-forget, and hands you the
   * lifecycle and the invalidation.
   */
  confirmation?: GaslessConfirmation;
  /** Confirmations for the receipt wait. Default `1`. Only for `confirmation: "receipt"`. */
  receiptConfirmations?: number;
  /** Budget for the terminal wait. Defaults to the SDK's `GASLESS_WAIT_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Budget for the receipt wait. Defaults to the SDK's `GASLESS_RECEIPT_TIMEOUT_MS`. */
  receiptTimeoutMs?: number;
  /**
   * Abort the wait when the hook unmounts. Default `true`.
   *
   * TanStack mutations do not cancel on unmount, so this is a deliberate
   * deviation — right for a modal that closes, wrong when you want the wait to
   * finish so the cache refreshes for the rest of the app. Either way the
   * invalidation still runs if a `succeeded` terminal was observed before the
   * abort.
   */
  abortOnUnmount?: boolean;
  /** Observer for every polled record — the imperative form of {@link GaslessRelayProgress}. */
  onProgress?: (request: GaslessRequest) => void;
  /**
   * Observer invoked the moment the service accepts the request — before any
   * confirmation, and before the `confirmation: "none"` early return.
   *
   * This is the persistence hook. There is no list-by-wallet endpoint, so a
   * request id that never left memory is unrecoverable: a reload, a crash or a
   * closed tab loses the only handle on a workflow that keeps running and will
   * spend the user's collateral. Persist `{ service, protocolInstance,
   * requestId, owner, walletIds, idempotencyKey }` here, not in `onSuccess`,
   * which does not run until the relay has landed — or never, if the wait
   * times out.
   *
   * Its own failures are swallowed: a broken observer must not fail a relay
   * that the service has already accepted.
   */
  onAccepted?: (accepted: GaslessAcceptedRequest) => void;
}

/**
 * What a confirmed relay hook resolves with.
 *
 * `accepted` stays nested rather than merged: `GaslessSubmitReceipt.status` is
 * the *acceptance* status (normally `queued`) while `GaslessRequest.status` is
 * the *terminal* one, and flattening them would put a field named `status`
 * holding "queued" on a result that means success.
 */
export interface GaslessRelayResult<accepted> {
  /** The `202` acceptance. Its `status` is never success. */
  accepted: accepted;
  /** The confirmation. Absent only when `confirmation: "none"`. */
  confirmed?: GaslessConfirmedRequest;
}

/**
 * Where a relay is, merged onto the mutation result as `relay`.
 *
 * A confirmed mutation stays pending for as long as the relayer takes, so
 * `isPending` alone cannot tell a user whether anything is happening. This
 * exposes the lifecycle without making every consumer mount a second hook.
 */
export interface GaslessRelayProgress {
  /**
   * Coarse phase, suitable for driving a label or a spinner.
   *
   * `"unconfirmed"` is the one that needs a deliberate UI: the wait ran out of
   * budget, so the relay's outcome is **unknown**, not failed. The request is
   * still running server-side — show the request id and keep watching it (the
   * mutation itself still rejects, because it cannot report a result it does not
   * have). Never re-run the intent through the wallet from this phase.
   */
  phase: "idle" | "submitting" | "queued" | "submitted" | "awaiting-receipt" | "confirmed" | "unconfirmed" | "error";
  /** Present from acceptance onward — persist it; a lost id is unrecoverable. */
  requestId?: string;
  /**
   * The idempotency key the request was submitted with, from acceptance onward.
   * Persist it with the id: resending the byte-identical request under this key
   * is what makes a lost response recoverable.
   */
  idempotencyKey?: string;
  /** The relayer's last reported status. */
  status?: GaslessRequestStatus;
  /** Present once the relayer broadcasts. */
  txHash?: Hash;
  /**
   * Whether the status is currently unreadable — a `429`, a `503`, a dropped
   * connection. The workflow is unaffected; only our view of it is stale, so
   * render "status unavailable" rather than anything that reads as a failure.
   * Clears as soon as a read succeeds.
   */
  degraded: boolean;
  /** The last transient read failure, while `degraded` — for diagnostics, never for a retry decision. */
  issue?: SymmioRequestError;
}

/** The initial, nothing-in-flight progress value. */
export const IDLE_RELAY_PROGRESS: GaslessRelayProgress = { phase: "idle", degraded: false };
