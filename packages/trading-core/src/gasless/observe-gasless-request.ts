import type { Config } from "../core/config";
import type { SymmError } from "../shared/errors/symm-error";
import { supportsGaslessStatusStream, watchGaslessRequest } from "../websocket/gasless/watch-gasless-request";
import type { GaslessRequest, GaslessService } from "./types";

/**
 * How a status wait follows a workflow.
 *
 * - `"auto"` (default): subscribe to the gateway's status stream when the
 *   deployment enables it, and poll only while the stream is not delivering.
 * - `"poll"`: HTTP polling only — the transport the SDK has always used.
 */
export type GaslessStatusTransport = "auto" | "poll";

/**
 * A live view of one workflow, fed by the status stream.
 *
 * The wait loop owns the HTTP polling; this only tells it when the stream is
 * carrying the workflow (so polling can stand down) and hands over the records
 * the stream delivered. The split keeps one rule intact: a `watch*` never
 * issues HTTP, and a poller never pretends to be a subscription.
 *
 * @internal
 */
export interface GaslessStatusObserver {
  /** Whether the stream is currently delivering this workflow. */
  isLive(): boolean;
  /** Take the newest record the stream delivered since the last call, if any. */
  take(): GaslessRequest | null;
  /**
   * Resolve on the next stream delivery, on a change in stream health, or after
   * `timeoutMs` — whichever comes first. The wait loop uses it instead of a
   * blind sleep, so a stream update is acted on the moment it lands.
   */
  wait(timeoutMs: number, signal?: AbortSignal): Promise<void>;
  /** Release the subscription. */
  close(): void;
}

/**
 * Subscribe to a workflow's status stream, when the deployment has one.
 *
 * Returns `null` when the chain cannot stream (no gasless block, streams not
 * enabled, a proxy with no declared gateway origin) or when the subscription
 * throws, so the caller simply keeps polling. Stream errors are reported
 * through `onTransportIssue` and never surface as workflow failures.
 *
 * @internal
 */
export function createGaslessStatusObserver(
  config: Config,
  parameters: {
    chainId?: number;
    requestId: string;
    service: GaslessService;
    onTransportIssue?: (error: SymmError) => void;
  },
): GaslessStatusObserver | null {
  const { chainId, requestId, service, onTransportIssue } = parameters;
  if (!supportsGaslessStatusStream(config, { chainId, service })) return null;

  let live = false;
  let pending: GaslessRequest | null = null;
  let wake: (() => void) | null = null;

  function notify(): void {
    const resume = wake;
    wake = null;
    resume?.();
  }

  let unwatch: () => void;
  try {
    unwatch = watchGaslessRequest(config, {
      chainId,
      requestId,
      service,
      onUpdate: (update) => {
        if (update.request) pending = update.request;
        notify();
      },
      onStatusChange: (status) => {
        const next = status === "live";
        if (next !== live) {
          live = next;
          notify();
        }
      },
      onError: (error) => {
        try {
          onTransportIssue?.(error);
        } catch {
          /** An observer must never break the wait it is observing. */
        }
      },
    });
  } catch {
    /** An unsupported or misconfigured stream is not a wait failure: poll instead. */
    return null;
  }

  return {
    isLive: () => live,
    take: () => {
      const record = pending;
      pending = null;
      return record;
    },
    wait: (timeoutMs, signal) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = (): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", finish);
          wake = null;
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        wake = finish;
        signal?.addEventListener("abort", finish, { once: true });
      }),
    close: () => {
      wake = null;
      unwatch();
    },
  };
}
