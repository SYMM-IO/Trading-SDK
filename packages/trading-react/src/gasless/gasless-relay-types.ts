import type {
  ConfigParameter,
  GaslessConfirmation,
  GaslessConfirmedRequest,
  GaslessRequest,
  GaslessRequestStatus,
} from "@symmio/trading-core";
import type { Hash } from "viem";

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
  /** Coarse phase, suitable for driving a label or a spinner. */
  phase: "idle" | "submitting" | "queued" | "submitted" | "awaiting-receipt" | "confirmed" | "error";
  /** Present from acceptance onward — persist it; a lost id is unrecoverable. */
  requestId?: string;
  /** The relayer's last reported status. */
  status?: GaslessRequestStatus;
  /** Present once the relayer broadcasts. */
  txHash?: Hash;
}

/** The initial, nothing-in-flight progress value. */
export const IDLE_RELAY_PROGRESS: GaslessRelayProgress = { phase: "idle" };
