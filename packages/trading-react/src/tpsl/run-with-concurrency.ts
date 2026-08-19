/**
 * Run `worker` over `items` with at most `limit` in flight, preserving start
 * order. A `limit` of `1` is a plain sequential loop.
 *
 * The worker is expected to swallow its own errors — this helper has no
 * short-circuit on rejection, because one failed item must never abandon the
 * rest (which is exactly what `Promise.all` over raw promises would do).
 *
 * `shouldStop` is the deliberate exception: it is consulted before each item is
 * picked up, so a caller can abort the remaining work on a condition it decides
 * (for example a wallet signature the user rejected — prompting again for every
 * remaining item is worse than stopping).
 *
 * @param items - Work items.
 * @param limit - Maximum concurrent workers. Values below `1` are treated as `1`.
 * @param worker - Invoked once per item.
 * @param shouldStop - Optional abort predicate, checked before each item starts.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  const size = Math.max(1, Math.trunc(limit));
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      if (shouldStop?.()) return;
      const index = cursor;
      cursor += 1;
      await worker(items[index]!);
    }
  });
  await Promise.all(lanes);
}
