import { computeBackoffDelay, type BackoffOptions } from "../websocket/socket/backoff";
import { classifyGaslessHttpStatus, type GaslessHttpFailureClass } from "./http";

/**
 * The failure classes a **read** may retry: the gateway dropped the call
 * (`429`), its configuration is not ready (`503`), or nothing answered
 * (a transport failure, a `408`, any other `5xx`).
 *
 * The distinction that matters is transient versus verdict. A status read has
 * no side effect, so retrying one can never duplicate anything — but reporting
 * a transient failure as a failed workflow can, by inviting a resubmit of a
 * request that is executing right now. Everything else (`401`, `403`, `404`
 * outside the accept race, `422`, a service `detail.code`) is an answer, and an
 * answer is not retried.
 */
const TRANSIENT_READ_FAILURES: ReadonlySet<GaslessHttpFailureClass> = new Set([
  "ambiguous",
  "rate-limited",
  "gateway-not-ready",
]);

/**
 * Whether a failed gasless status read should be retried rather than surfaced.
 *
 * Read structurally, so an error a framework layer re-wrapped classifies like
 * the `SymmApiError` underneath it.
 *
 * @param err - Anything caught from a status read.
 * @returns `true` for a transient transport failure, `false` for a verdict.
 *
 * @internal
 */
export function isTransientGaslessReadError(err: unknown): boolean {
  const failure = classifyGaslessHttpStatus(err);
  return failure !== null && TRANSIENT_READ_FAILURES.has(failure);
}

/** The `Retry-After` the gateway asked for, in ms, read structurally. @internal */
export function readGaslessRetryAfterMs(err: unknown): number | null {
  const value = (err as { retryAfterMs?: unknown } | undefined)?.retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Backoff schedule for retried status reads: 1 s doubling to 30 s, jittered. */
const READ_BACKOFF: BackoffOptions = { baseDelayMs: 1_000, maxDelayMs: 30_000, jitter: true };

/**
 * How long to wait before retrying a transient status read.
 *
 * The gateway's own `Retry-After` wins when it sent one and the browser was
 * allowed to read it — a cross-origin page usually sees `null`, which is why it
 * can never shorten the wait below the backoff. The jitter keeps a page's
 * concurrent workflows from retrying in lockstep, which is what turns one
 * `429` into a stampede of them.
 *
 * @param attempt - Zero-based consecutive-failure index.
 * @param err - The failure, for its `Retry-After`.
 * @param random - Injectable `Math.random`, for deterministic tests.
 * @returns The delay in ms.
 *
 * @internal
 */
export function gaslessTransientReadDelay(attempt: number, err: unknown, random: () => number = Math.random): number {
  return Math.max(readGaslessRetryAfterMs(err) ?? 0, computeBackoffDelay(attempt, READ_BACKOFF, random));
}
