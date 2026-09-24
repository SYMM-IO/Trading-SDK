/**
 * Accumulated-funding state of one (symbol, partyB) pair — the SYMMIO core
 * diamond's `FundingFee` struct, read with {@link getFundingFeesOfPartyB}.
 * Field names and order mirror the contract exactly.
 *
 * Every rate and fee here is the **raw, cost-positive** contract value: a
 * positive long/short value means that side's trader **pays**. That is the
 * opposite of the SDK's income-positive funding **amounts** (`netReceived`,
 * `pendingNetReceived`) — these are per-unit rates, not amounts, and the SDK
 * does not re-sign them.
 *
 * The pair is in one of three states:
 *
 * - `epochDuration === 0n` — accumulated funding is **not configured** for the
 *   pair. Legacy funding may still apply; it moves the quote's `openedPrice`
 *   (so it is already inside a mark-price uPnL) and has no pending amount.
 * - `epochDuration > 0n && startEpoch === 0n && startEpochTimeStamp === 0n` —
 *   **configured but not started**: a duration is set but the solver has not
 *   posted a rate yet, so nothing accrues.
 * - otherwise — **accruing**: every open quote on the pair accrues funding each
 *   epoch until it is charged or closed; read that per quote with
 *   {@link getQuotePendingFunding}.
 *
 * On v0.8.5 the `lastUpdated*` fields and `accumulated*Rate` are re-folded on
 * every quote operation on the pair; on v0.8.6 they move only on solver
 * configuration or a symbol restatement, so exact integers can differ between
 * the two generations by rounding dust.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/core/storages/FundingStorage.sol}
 */
export interface FundingFee {
  /**
   * Current per-epoch long rate, price-adjusted (`rate × marketPrice at the
   * last update / 1e18`, 18-decimal). Positive = longs pay. `0n` during a
   * symbol restatement, rebased afterwards.
   */
  currentLongRate: bigint;
  /**
   * Current per-epoch short rate, price-adjusted (`rate × marketPrice at the
   * last update / 1e18`, 18-decimal). Positive = shorts pay. `0n` during a
   * symbol restatement, rebased afterwards.
   */
  currentShortRate: bigint;
  /**
   * Weighted-average per-epoch long rate over `[startEpoch, lastUpdatedEpoch]`
   * (18-decimal, price-adjusted). An average rate, **not** a cumulative amount.
   */
  accumulatedLongRate: bigint;
  /**
   * Weighted-average per-epoch short rate over `[startEpoch, lastUpdatedEpoch]`
   * (18-decimal, price-adjusted). An average rate, **not** a cumulative amount.
   */
  accumulatedShortRate: bigint;
  /**
   * Absolute epoch index (`floor(timestamp / epochDuration)`) at which the
   * accumulated rates were last folded. On v0.8.5 this also moves on every
   * quote operation on the pair.
   */
  lastUpdatedEpoch: bigint;
  /**
   * Unix timestamp (seconds) at which the accumulated rates were last folded.
   * On v0.8.5 this also moves on every quote operation on the pair.
   */
  lastUpdatedTimeStamp: bigint;
  /**
   * Unix timestamp (seconds) the **current** funding history started at: the
   * solver's first rate update, re-based to the fold time whenever
   * `epochDuration` changes (the fee accrued before that change is carried in
   * `snapshotLongFee` / `snapshotShortFee`). `0n` until the first rate update.
   */
  startEpochTimeStamp: bigint;
  /**
   * Absolute epoch index (`floor(timestamp / epochDuration)`) the current
   * funding history started at — re-based alongside `startEpochTimeStamp` on an
   * `epochDuration` change. `0n` until the first rate update.
   */
  startEpoch: bigint;
  /** Epoch length in seconds. `0n` = accumulated funding is not configured for the pair. */
  epochDuration: bigint;
  /** Cumulative per-unit long fee (18-decimal) carried over from before the last `epochDuration` change. */
  snapshotLongFee: bigint;
  /** Cumulative per-unit short fee (18-decimal) carried over from before the last `epochDuration` change. */
  snapshotShortFee: bigint;
}
