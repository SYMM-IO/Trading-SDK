import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessSleep } from "../abortable-sleep";
import { getGaslessRequest } from "../get-gasless-request/get-gasless-request";
import { createGaslessStatusObserver, type GaslessStatusTransport } from "../observe-gasless-request";
import { gaslessTransientReadDelay, isTransientGaslessReadError } from "../transient-read";
import {
  GASLESS_QUEUED_POLL_MS,
  GASLESS_SUBMITTED_POLL_MS,
  GaslessRequestStatus,
  isGaslessRequestTerminal,
  type GaslessRequest,
  type GaslessService,
} from "../types";

/** Default overall wait budget. */
export const GASLESS_WAIT_TIMEOUT_MS = 120_000;
/**
 * Consecutive `404`s tolerated right after a `202`: the accepted workflow's
 * record may not be readable immediately (the accept-vs-record race).
 */
const NOT_FOUND_TOLERANCE = 3;

/**
 * Parameters for {@link waitForGaslessRequest}.
 */
export type WaitForGaslessRequestParameters = Compute<
  ChainIdParameter & {
    /** Stable service tracking id returned by a gasless submit. */
    requestId: string;
    /** Which sub-service stores the request. Defaults to `"operations"`. */
    service?: GaslessService;
    /**
     * When to resolve. `"broadcast"` resolves as soon as a transaction hash
     * exists (status `submitted`, or a terminal that carries one);
     * `"terminal"` (default) waits for `succeeded` / `reverted` / `failed` /
     * `rejected`.
     */
    until?: "broadcast" | "terminal";
    /** Overall wait budget in ms. Default {@link GASLESS_WAIT_TIMEOUT_MS}. */
    timeoutMs?: number;
    /** Poll cadence while `queued`. Default {@link GASLESS_QUEUED_POLL_MS}. */
    queuedPollMs?: number;
    /** Poll cadence after `submitted`. Default {@link GASLESS_SUBMITTED_POLL_MS}. */
    submittedPollMs?: number;
    /** Abort the wait (e.g. on unmount). The request itself keeps running server-side. */
    signal?: AbortSignal;
    /** Observer invoked with every fetched record, including the final one. */
    onUpdate?: (request: GaslessRequest) => void;
    /**
     * Observer invoked for every transient read failure the loop absorbed —
     * a `429`, a `503`, a dropped connection.
     *
     * Nothing is wrong with the workflow when this fires; only our view of it
     * is stale. Surface it as "status unavailable, still running", never as a
     * failed relay, and never as a reason to resubmit.
     */
    onTransportIssue?: (error: SymmError) => void;
    /**
     * How to follow the workflow. `"auto"` (default) subscribes to the
     * gateway's status stream when the deployment enables it and polls only
     * while the stream is not delivering; `"poll"` forces HTTP polling.
     *
     * The outcome is identical either way — the stream carries the same records
     * the reads return, so a caller cannot tell which transport produced one.
     */
    transport?: GaslessStatusTransport;
  }
>;

/** Return type of {@link waitForGaslessRequest}. */
export type WaitForGaslessRequestReturnType = GaslessRequest;

/**
 * Poll one gasless request until it broadcasts or reaches a terminal status.
 *
 * The relayer is fire-and-forget, so this loop is the client's half of the
 * lifecycle. It resolves with the record — including for `reverted` / `failed`
 * / `rejected` terminals, which are workflow outcomes, not transport failures;
 * branch on `status` (only `succeeded` is success).
 *
 * **A failed read is not a failed request.** Once a `202` exists the workflow
 * is running whether or not we can see it, so every transient transport
 * failure — a dropped connection, a `408`, a `429`, a `5xx` — is absorbed:
 * reported through `onTransportIssue`, then retried after
 * `max(Retry-After, jittered 1 s → 30 s backoff)`, capped by whatever budget is
 * left. Up to three consecutive `404`s are tolerated too, for the brief
 * accept-vs-record race after a submit.
 *
 * It throws only when it can no longer answer the question it was asked: the
 * budget ran out, the caller aborted, the record is still `404` on the fourth
 * consecutive read, or the service gave a definitive answer (`401`, `403`,
 * `422`, a service error code). A timeout carries the last transient failure as
 * its `cause`, so a caller can tell "the relayer is slow" from "we went blind".
 *
 * @param config - The SDK config.
 * @param parameters - Request id, wait target, cadence, budget, abort signal.
 * @returns The record at broadcast (`until: "broadcast"`) or at terminal.
 * @throws {SymmError} `GASLESS_BROADCAST_TIMEOUT` / `GASLESS_TERMINAL_TIMEOUT`
 *   when the budget runs out — the request may still land later; keep the
 *   `requestId` and keep watching, never re-submit through the wallet.
 * @throws {SymmError} `GASLESS_WAIT_ABORTED` when `signal` aborts.
 *
 * @example
 * ```ts
 * const record = await waitForGaslessRequest(config, {
 *   requestId,
 *   until: "broadcast",
 *   onTransportIssue: () => setDegraded(true),
 * });
 * if (record.txHash) await client.waitForTransactionReceipt({ hash: record.txHash });
 * ```
 */
export async function waitForGaslessRequest(
  config: Config,
  parameters: WaitForGaslessRequestParameters,
): Promise<WaitForGaslessRequestReturnType> {
  const {
    chainId,
    requestId,
    service = "operations",
    until = "terminal",
    timeoutMs = GASLESS_WAIT_TIMEOUT_MS,
    queuedPollMs = GASLESS_QUEUED_POLL_MS,
    submittedPollMs = GASLESS_SUBMITTED_POLL_MS,
    signal,
    onUpdate,
    onTransportIssue,
    transport = "auto",
  } = parameters;

  const deadline = Date.now() + timeoutMs;
  /**
   * The status stream, when this deployment has one. It delivers the same
   * records the reads return, so the loop below simply prefers them and lets
   * the polling stand down while the stream is live.
   */
  const observer =
    transport === "poll"
      ? null
      : createGaslessStatusObserver(config, { chainId, requestId, service, onTransportIssue });
  let notFoundStreak = 0;
  let transientStreak = 0;
  let lastTransient: SymmError | undefined;
  let latest: GaslessRequest | null = null;

  try {
    for (;;) {
      if (signal?.aborted) {
        throw new SymmError("api", "GASLESS_WAIT_ABORTED", "Gasless: the status wait was aborted.");
      }

      /** The next poll's delay: the status cadence, or a backoff after a transient failure. */
      let interval = latest?.status === GaslessRequestStatus.SUBMITTED ? submittedPollMs : queuedPollMs;

      /**
       * While the stream carries this workflow, it is the fresher source and the
       * poll stands down: take whatever it delivered, and otherwise sleep until
       * the next delivery or until the stream stops being live.
       */
      if (observer?.isLive()) {
        const streamed = observer.take();
        if (streamed) {
          latest = streamed;
          notFoundStreak = 0;
          transientStreak = 0;
          onUpdate?.(latest);
          if (until === "broadcast" && latest.txHash !== null) return latest;
          if (isGaslessRequestTerminal(latest.status)) return latest;
        }
        const remainingWhileLive = deadline - Date.now();
        if (remainingWhileLive <= 0) throw timeoutError();
        await observer.wait(Math.min(interval, remainingWhileLive), signal);
        continue;
      }

      try {
        latest = await getGaslessRequest(config, { chainId, requestId, service, signal });
        notFoundStreak = 0;
        transientStreak = 0;
        onUpdate?.(latest);

        if (until === "broadcast" && latest.txHash !== null) return latest;
        if (isGaslessRequestTerminal(latest.status)) return latest;
        interval = latest.status === GaslessRequestStatus.SUBMITTED ? submittedPollMs : queuedPollMs;
      } catch (err) {
        /** An abort cancels the read in flight; that cancellation is not a transport issue. */
        if (signal?.aborted) {
          throw new SymmError("api", "GASLESS_WAIT_ABORTED", "Gasless: the status wait was aborted.");
        }
        const isNotFound = err instanceof SymmApiError && err.status === 404;
        if (isNotFound) {
          if (++notFoundStreak > NOT_FOUND_TOLERANCE) throw err;
        } else if (isTransientGaslessReadError(err)) {
          /**
           * The workflow is running whether or not we can read it. Report the
           * blind spot and back off — treating this as a failure is what makes a
           * caller resubmit an intent that is already executing.
           */
          lastTransient = err instanceof SymmError ? err : undefined;
          interval = gaslessTransientReadDelay(transientStreak++, err);
          if (lastTransient) {
            try {
              onTransportIssue?.(lastTransient);
            } catch {
              /** An observer must never break the wait it is observing. */
            }
          }
        } else {
          throw err;
        }
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) throw timeoutError();

      /** Never sleep past the budget: a 30 s backoff must not hide a 5 s timeout. */
      await gaslessSleep(Math.min(interval, remaining), signal);
    }
  } finally {
    observer?.close();
  }

  function timeoutError(): SymmError {
    return new SymmError(
      "api",
      until === "broadcast" ? "GASLESS_BROADCAST_TIMEOUT" : "GASLESS_TERMINAL_TIMEOUT",
      `Gasless: request ${requestId} did not reach ${until === "broadcast" ? "broadcast" : "a terminal status"} within ${timeoutMs} ms (last status: ${latest?.status ?? "unknown"}). The request keeps running server-side — keep polling it; never re-submit through the wallet.`,
      { cause: lastTransient },
    );
  }
}
