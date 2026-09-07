import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getGaslessRequest } from "../get-gasless-request/get-gasless-request";
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
  }
>;

/** Return type of {@link waitForGaslessRequest}. */
export type WaitForGaslessRequestReturnType = GaslessRequest;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new SymmError("api", "GASLESS_WAIT_ABORTED", "Gasless: the status wait was aborted."));
    }
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Poll one gasless request until it broadcasts or reaches a terminal status.
 *
 * The relayer is fire-and-forget, so this loop is the client's half of the
 * lifecycle. It resolves with the record — including for `reverted` / `failed`
 * / `rejected` terminals, which are workflow outcomes, not transport failures;
 * branch on `status` (only `succeeded` is success). It throws only for
 * transport-level problems: an exhausted wait budget, an abort, or a
 * persistent fetch failure. Up to three consecutive `404`s are tolerated right
 * after a submit (the accepted record may not be readable yet); a `404`
 * afterwards is thrown as-is — and must never be treated as "the relay is
 * unavailable" once a `202` exists.
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
 * const record = await waitForGaslessRequest(config, { requestId, until: "broadcast" });
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
  } = parameters;

  const deadline = Date.now() + timeoutMs;
  let notFoundStreak = 0;
  let latest: GaslessRequest | null = null;

  for (;;) {
    if (signal?.aborted) {
      throw new SymmError("api", "GASLESS_WAIT_ABORTED", "Gasless: the status wait was aborted.");
    }

    try {
      latest = await getGaslessRequest(config, { chainId, requestId, service });
      notFoundStreak = 0;
      onUpdate?.(latest);

      if (until === "broadcast" && latest.txHash !== null) return latest;
      if (isGaslessRequestTerminal(latest.status)) return latest;
    } catch (err) {
      const isNotFound = err instanceof SymmApiError && err.status === 404;
      if (!isNotFound || ++notFoundStreak > NOT_FOUND_TOLERANCE) throw err;
    }

    if (Date.now() >= deadline) {
      throw new SymmError(
        "api",
        until === "broadcast" ? "GASLESS_BROADCAST_TIMEOUT" : "GASLESS_TERMINAL_TIMEOUT",
        `Gasless: request ${requestId} did not reach ${until === "broadcast" ? "broadcast" : "a terminal status"} within ${timeoutMs} ms (last status: ${latest?.status ?? "unknown"}). The request keeps running server-side — keep polling it; never re-submit through the wallet.`,
      );
    }

    const interval = latest?.status === GaslessRequestStatus.SUBMITTED ? submittedPollMs : queuedPollMs;
    await sleep(interval, signal);
  }
}
