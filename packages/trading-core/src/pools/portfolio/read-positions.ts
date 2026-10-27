import { readOptional, type PoolReadGap } from "../composition";

/** Per-portfolio queue: no more than five endpoint requests, including retries. */
export function createPositionReader(gaps: PoolReadGap[]) {
  let active = 0;
  const waiting: (() => void)[] = [];
  let authenticationError: unknown;
  return async function readPosition<T>(read: () => Promise<T>, source: string, address: string): Promise<T | null> {
    if (active >= 5) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await readOptional(
        async () => {
          try {
            if (authenticationError) throw authenticationError;
            return await read();
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "status" in error &&
              (error.status === 401 || error.status === 403)
            ) {
              authenticationError = error;
              throw error;
            }
            if (authenticationError) throw authenticationError;
            try {
              return await read();
            } catch (retryError) {
              if (
                retryError &&
                typeof retryError === "object" &&
                "status" in retryError &&
                (retryError.status === 401 || retryError.status === 403)
              )
                authenticationError = retryError;
              throw retryError;
            }
          }
        },
        gaps,
        source,
        address,
      );
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
