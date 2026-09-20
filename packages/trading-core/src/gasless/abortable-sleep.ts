import { SymmError } from "../shared/errors/symm-error";

/** The error an aborted gasless wait, poll delay or rate-limit wait rejects with. @internal */
export function gaslessAbortedError(what: string): SymmError {
  return new SymmError("api", "GASLESS_WAIT_ABORTED", `Gasless: ${what} was aborted.`);
}

/**
 * Sleep that rejects as soon as `signal` aborts, instead of holding the caller
 * until the timer it is waiting on happens to fire.
 *
 * @param ms - How long to wait.
 * @param signal - Abort signal; an already-aborted one rejects synchronously.
 * @param what - What is being waited on, for the error message.
 * @returns A promise that resolves after `ms`.
 * @throws {SymmError} `GASLESS_WAIT_ABORTED` when `signal` aborts first.
 *
 * @internal
 */
export function gaslessSleep(ms: number, signal?: AbortSignal, what = "the status wait"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(gaslessAbortedError(what));
    }
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
