import { readOptional, type PoolReadGap } from "../composition";

/** Per-portfolio queue: no more than five endpoint requests, including retries. */
export function createPositionReader(gaps: PoolReadGap[]) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function readPosition<T>(read: () => Promise<T>, source: string, address: string): Promise<T | null> {
    if (active >= 5) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await readOptional(
        async () => {
          try {
            return await read();
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "status" in error &&
              (error.status === 401 || error.status === 403)
            )
              throw error;
            return read();
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
