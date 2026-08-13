import { SymmioRequestError } from "../errors/symmio-request-error";
import { useTpSlStore } from "./tpsl-store";

/**
 * How long a grouped run waits for confirmation before giving up, in
 * milliseconds.
 *
 * Sized to cover both halves of the wait: the report owns the first
 * `TPSL_FALLBACK_POLL_DELAY_MS` (30s) alone, and the fallback sweep then reads
 * the handler every couple of seconds for the remainder. Cutting this short
 * would fail steps the sweep had barely begun to check.
 */
export const DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS = 60_000;

/**
 * How long the fallback refetch gets to land before the run gives up on the
 * steps that are still unconfirmed, in milliseconds.
 */
export const TPSL_CONFIRMATION_REFETCH_GRACE_MS = 5_000;

/** Options for {@link awaitTpSlConfirmation}. */
export interface AwaitTpSlConfirmationOptions {
  /** Reconcile the run's steps against the store. Called on every store change. */
  settle: () => void;
  /** Whether any step is still waiting. Read straight after `settle`. */
  hasPending: () => boolean;
  /** Refetch the handler's rows — the fallback when no report arrives. */
  onTimeout: () => void;
  /** Give up on whatever is still pending after the fallback had its grace window. */
  onExpire: () => void;
  /**
   * Called once, only when there is genuinely something to wait for. Return a
   * disposer to tear down whatever it started.
   *
   * The seam the fallback sweep hangs off: it starts when the wait starts and
   * is disposed by the same `finish()` that resolves the wait, so it cannot
   * outlive the run — including when the component that began the run has
   * unmounted. Throwing from either the hook or its disposer is swallowed; this
   * function's contract is that it never rejects.
   */
  onWait?: () => (() => void) | void;
  /** Report deadline. Defaults to {@link DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Fallback grace window. Defaults to {@link TPSL_CONFIRMATION_REFETCH_GRACE_MS},
   * capped at `timeoutMs` — a caller who only waits a moment for the report
   * does not then wait longer than that for the refetch.
   */
  graceMs?: number;
}

/**
 * Resolve once every step of a TP/SL run has been confirmed — or once the run
 * has stopped waiting for the ones that never were.
 *
 * The wait is driven by the shared TP/SL store rather than by a React effect,
 * so it survives the component unmounting mid-run (a trader closing the modal)
 * and still terminates. Two deadlines bound it: at `timeoutMs` the handler's
 * rows are refetched, and `graceMs` later whatever is still pending is failed.
 *
 * @param options - The run's reconcile/pending probes and its two fallbacks.
 * @returns Resolves when nothing is pending. Never rejects.
 *
 * @example
 * ```ts
 * await awaitTpSlConfirmation({
 *   settle: () => reconcileSteps(),
 *   hasPending: () => runRef.current.steps.some((step) => step.status === "confirming"),
 *   onTimeout: () => void invalidateTpSlReads(queryClient, ids),
 *   onExpire: () => failPendingSteps(),
 * });
 * ```
 */
export function awaitTpSlConfirmation(options: AwaitTpSlConfirmationOptions): Promise<void> {
  const {
    settle,
    hasPending,
    onTimeout,
    onExpire,
    onWait,
    timeoutMs = DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS,
    graceMs = Math.min(TPSL_CONFIRMATION_REFETCH_GRACE_MS, timeoutMs),
  } = options;

  settle();
  if (!hasPending()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    /** Started only now that the wait is real; disposed on every exit path. */
    let disposeWait: (() => void) | void;
    try {
      disposeWait = onWait?.();
    } catch {
      disposeWait = undefined;
    }

    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(deadline);
      if (graceTimer !== undefined) clearTimeout(graceTimer);
      try {
        disposeWait?.();
      } catch {
        // A failing disposer must not turn a resolved wait into a rejection.
      }
      resolve();
    };

    const unsubscribe = useTpSlStore.subscribe(() => {
      settle();
      if (!hasPending()) finish();
    });

    const deadline = setTimeout(() => {
      onTimeout();
      graceTimer = setTimeout(() => {
        onExpire();
        finish();
      }, graceMs);
    }, timeoutMs);
  });
}

/**
 * `SymmioRequestError.code` of a step the handler accepted but never reported
 * on. Distinguishes "we stopped waiting" from "the request was rejected".
 */
export const TPSL_CONFIRMATION_TIMEOUT_CODE = "TPSL_CONFIRMATION_TIMEOUT";

/** The error a step carries when the handler never confirmed it. */
export function tpslConfirmationTimeoutError(): SymmioRequestError {
  return new SymmioRequestError({
    kind: "sdk",
    code: TPSL_CONFIRMATION_TIMEOUT_CODE,
    message: "The handler never confirmed this order. Check the position's exits before retrying.",
  });
}
