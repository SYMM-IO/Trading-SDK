/**
 * Tuning for the exponential-backoff reconnect schedule.
 */
export interface BackoffOptions {
  /** Delay before the first retry (attempt 0), in ms. */
  baseDelayMs: number;
  /** Upper bound on any single delay, in ms. */
  maxDelayMs: number;
  /** Apply random jitter so reconnecting clients do not stampede. */
  jitter: boolean;
}

/**
 * Compute the delay before reconnect `attempt` (0-based).
 *
 * Without jitter the delay is `min(maxDelayMs, baseDelayMs · 2^attempt)`. With
 * jitter the result is scaled by a random factor in `[0.5, 1]` (half jitter),
 * spreading retries across a window instead of synchronizing them.
 *
 * @param attempt - Zero-based retry index. Attempt 0 returns ~`baseDelayMs`.
 * @param options - Backoff tuning.
 * @param random - Source of randomness in `[0, 1)`. Injectable for deterministic tests; defaults to `Math.random`.
 * @returns Delay in milliseconds.
 *
 * @example
 * ```ts
 * computeBackoffDelay(0, { baseDelayMs: 500, maxDelayMs: 10_000, jitter: false }); // 500
 * computeBackoffDelay(5, { baseDelayMs: 500, maxDelayMs: 10_000, jitter: false }); // 10_000 (capped)
 * ```
 */
export function computeBackoffDelay(
  attempt: number,
  options: BackoffOptions,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** attempt);
  if (!options.jitter) return exponential;
  return Math.round(exponential * (0.5 + random() * 0.5));
}
