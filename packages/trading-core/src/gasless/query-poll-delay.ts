import { gaslessPollDelay, type GaslessRequestStatus } from "./types";

/**
 * The slice of a TanStack query's state the poll jitter is seeded from. Both
 * fields are millisecond timestamps that move on every settled fetch.
 */
interface GaslessPollSeedState {
  dataUpdatedAt?: number;
  errorUpdatedAt?: number;
}

/**
 * One deterministic draw in `[0, 1)` from an integer seed — a single mulberry32
 * mixing step. The same seed always yields the same number, which is the whole
 * point here.
 */
function seededDraw(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/**
 * The jittered poll delay for a query's current state: stable between renders,
 * redrawn after every fetch.
 *
 * A `refetchInterval` callback must **not** return a fresh random number on
 * every call. TanStack recomputes it inside `QueryObserver.setOptions` and
 * restarts the countdown whenever the value differs from the running one, and
 * React calls `setOptions` on every render. A `Math.random()` delay therefore
 * restarts the timer on each render, so a component that re-renders faster than
 * the band — a price tick, a relay-progress publish, StrictMode — fetches once
 * and never polls again: exactly the frozen-at-`queued` UI this cadence exists
 * to prevent.
 *
 * Seeding the draw with the timestamps of the last settled fetch keeps the
 * jitter that the shared anonymous budget needs — every fetch moves the seed,
 * so every poll draws again — while the value stays constant for as long as
 * nothing has been fetched.
 *
 * @param status - The last known request status, or `undefined` before the first fetch.
 * @param state - The query's `state`; only its update timestamps are read.
 * @returns Milliseconds until the next poll, or `false` once the record is terminal.
 *
 * @example
 * ```ts
 * refetchInterval: (query) => gaslessQueryPollDelay(query.state.data?.status, query.state);
 * ```
 */
export function gaslessQueryPollDelay(
  status: GaslessRequestStatus | undefined,
  state: GaslessPollSeedState,
): number | false {
  const draw = seededDraw((state.dataUpdatedAt ?? 0) ^ (state.errorUpdatedAt ?? 0));
  return gaslessPollDelay(status, () => draw);
}
