import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";

/** Bound a mounted portfolio's shared query functions, including manual refreshes. */
export function usePoolReadQueue() {
  return useMemo(() => {
    let active = 0;
    const waiting: (() => void)[] = [];
    return async function run<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
      if (active >= 5) await new Promise<void>((resolve) => waiting.push(resolve));
      else active++;
      try {
        signal.throwIfAborted();
        return await read();
      } catch (error) {
        throw normalizeSymmError(error);
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    };
  }, []);
}

/** TanStack retries individual failed reads once, never authentication failures. */
export function retryPoolRead(failureCount: number, error: Error): boolean {
  const status = "status" in error ? error.status : undefined;
  return failureCount < 1 && status !== 401 && status !== 403;
}
