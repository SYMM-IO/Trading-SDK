import type { Hash, TransactionReceipt } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fireGaslessEvent, toGaslessRecordBody } from "../events";
import { resolveGaslessService } from "../resolve-gasless";
import { GaslessRequestStatus, type GaslessRequest, type GaslessService } from "../types";
import { waitForGaslessRequest } from "../wait-for-gasless-request/wait-for-gasless-request";

/** Default budget for the receipt wait, once the relayer reports `succeeded`. */
export const GASLESS_RECEIPT_TIMEOUT_MS = 60_000;

/**
 * How far a relayed request is followed before it counts as done.
 *
 * - `"none"` — the 202 acceptance is the answer. You own the lifecycle and the
 *   cache invalidation.
 * - `"terminal"` — the relayer reports `succeeded`. Its node saw the receipt;
 *   yours may not have.
 * - `"receipt"` — additionally waits for the receipt on your own client, so the
 *   state is readable by the reads you are about to invalidate.
 */
export type GaslessConfirmation = "none" | "terminal" | "receipt";

/** A relayed request followed through to on-chain reality. */
export interface GaslessConfirmedRequest {
  /** The terminal record. Always `succeeded` — anything else threw. */
  request: GaslessRequest;
  /** The broadcast transaction hash. */
  txHash: Hash;
  /**
   * Receipt from this config's client. Absent when `until: "terminal"`, and
   * absent when the receipt wait ran out of budget — see the timeout note on
   * {@link confirmGaslessRequest}.
   */
  receipt?: TransactionReceipt;
}

/**
 * Parameters for {@link confirmGaslessRequest}.
 */
export type ConfirmGaslessRequestParameters = Compute<
  ChainIdParameter & {
    /** Stable service tracking id returned by a gasless submit. */
    requestId: string;
    /** Which sub-service stores the request. Defaults to `"operations"`. */
    service?: GaslessService;
    /** How far to follow the request. Defaults to `"terminal"`. */
    until?: Exclude<GaslessConfirmation, "none">;
    /** Confirmations to wait for. Default `1`. Ignored unless `until: "receipt"`. */
    receiptConfirmations?: number;
    /** Budget for the terminal wait. */
    timeoutMs?: number;
    /** Budget for the receipt wait. Default {@link GASLESS_RECEIPT_TIMEOUT_MS}. */
    receiptTimeoutMs?: number;
    /** Poll cadence while `queued`. */
    queuedPollMs?: number;
    /** Poll cadence after `submitted`. */
    submittedPollMs?: number;
    /** Abort the wait (e.g. on unmount). The request keeps running server-side. */
    signal?: AbortSignal;
    /** Observer invoked with every fetched record, including the final one. */
    onUpdate?: (request: GaslessRequest) => void;
  }
>;

/** Return type of {@link confirmGaslessRequest}. */
export type ConfirmGaslessRequestReturnType = GaslessConfirmedRequest;

/**
 * Follow one accepted relay request through to on-chain reality.
 *
 * This is the opinionated layer above {@link waitForGaslessRequest}: where the
 * driver resolves with whatever terminal it reaches, this resolves **only** on
 * `succeeded` and throws for `reverted` / `failed` / `rejected`, with the record
 * attached to the error's `responseData`. That split is deliberate — the driver
 * reports facts, this one asserts the outcome a caller is waiting for.
 *
 * With `until: "receipt"` it then waits for the receipt on *this config's*
 * client. That matters more than it looks: the relayer's `succeeded` is the
 * relayer's node's view, and invalidating cached reads against a node that has
 * not seen the block re-reads pre-state, which is the stalled UI this whole
 * mechanism exists to prevent.
 *
 * **A receipt-wait timeout is not a failure.** The relayer already reported the
 * transaction mined with `status = 1`; the receipt wait is a freshness barrier
 * on your RPC, not a source of truth. On timeout this resolves with `receipt`
 * absent rather than throwing — turning a succeeded action into an error
 * because a public RPC lagged would be a worse bug than the one being fixed.
 *
 * Never re-submits: a 202 is the point of no return.
 *
 * @param config - The SDK config.
 * @param parameters - Request id, how far to follow it, and the budgets.
 * @returns The terminal record, its transaction hash, and (for `"receipt"`) the receipt.
 * @throws {SymmApiError} `GASLESS_RELAY_REJECTED` / `GASLESS_RELAY_REVERTED` /
 *   `GASLESS_RELAY_FAILED` on a non-succeeded terminal, carrying the record.
 * @throws {SymmError} `GASLESS_SUCCEEDED_WITHOUT_TX` when a `succeeded` record has no hash.
 * @throws {SymmError} `GASLESS_WAIT_ABORTED` when `signal` aborts — this means
 *   nobody is watching any more, **not** that the action failed.
 *
 * @example
 * ```ts
 * const { request, receipt } = await confirmGaslessRequest(config, {
 *   requestId: accepted.requestId,
 *   until: "receipt",
 * });
 * ```
 */
export async function confirmGaslessRequest(
  config: Config,
  parameters: ConfirmGaslessRequestParameters,
): Promise<ConfirmGaslessRequestReturnType> {
  const {
    chainId,
    requestId,
    service = "operations",
    until = "terminal",
    receiptConfirmations = 1,
    receiptTimeoutMs = GASLESS_RECEIPT_TIMEOUT_MS,
    signal,
    onUpdate,
  } = parameters;

  const gasless = resolveGaslessService(config, { chainId });
  const events = gasless.execution?.onEvent;

  const record = await waitForGaslessRequest(config, {
    chainId,
    requestId,
    service,
    until: "terminal",
    timeoutMs: parameters.timeoutMs,
    queuedPollMs: parameters.queuedPollMs,
    submittedPollMs: parameters.submittedPollMs,
    signal,
    onUpdate,
  });

  fireGaslessEvent(events, {
    type: "terminal",
    requestId: record.requestId,
    status: record.status,
    txHash: record.txHash,
    chainId: config.getChainConfig(chainId).chainId,
  });

  if (record.status !== GaslessRequestStatus.SUCCEEDED) {
    throw new SymmApiError({
      code: TERMINAL_ERROR_CODES[record.status],
      message: `Gasless: request ${record.requestId} ended ${record.status}${record.errorMessage ? ` — ${record.errorMessage}` : ""}.`,
      status: 200,
      statusText: "OK",
      responseData: toGaslessRecordBody(record),
      url: gasless.url,
      method: "GET",
    });
  }

  if (record.txHash === null) {
    throw new SymmError(
      "api",
      "GASLESS_SUCCEEDED_WITHOUT_TX",
      `Gasless: request ${record.requestId} reports succeeded but carries no transaction hash.`,
    );
  }
  const txHash = record.txHash;

  if (until === "terminal") return { request: record, txHash };

  const client = config.getClient({ chainId });
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      confirmations: receiptConfirmations,
      timeout: receiptTimeoutMs,
    });
    return { request: record, txHash, receipt };
  } catch {
    /**
     * The transaction is mined — the relayer watched it happen. Only our view
     * of it is late, so report the success we already have.
     */
    return { request: record, txHash };
  }
}

/** Which typed error a non-succeeded terminal raises. */
const TERMINAL_ERROR_CODES: Record<Exclude<GaslessRequestStatus, GaslessRequestStatus.SUCCEEDED>, string> = {
  [GaslessRequestStatus.REJECTED]: "GASLESS_RELAY_REJECTED",
  [GaslessRequestStatus.REVERTED]: "GASLESS_RELAY_REVERTED",
  [GaslessRequestStatus.FAILED]: "GASLESS_RELAY_FAILED",
  [GaslessRequestStatus.QUEUED]: "GASLESS_RELAY_FAILED",
  [GaslessRequestStatus.SUBMITTED]: "GASLESS_RELAY_FAILED",
};
